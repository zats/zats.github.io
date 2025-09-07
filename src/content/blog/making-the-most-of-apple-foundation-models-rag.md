---
title: "Making the most of Apple Foundation Models: RAG"
description: "Enable Apple Foundation Models deal with new or domain-specific information on device."
pubDate: 2025-09-10
draft: true
heroImage: "/assets/2025-09-10/image.jpg"
---

Retrieval augmented generation makes Apple’s on device Foundation Model answer questions about things it never trained on, without touching the network. Every model has a knowledge cutoff. Ask outside that window and it hallucinates or says it does not know. The fix is to retrieve missing facts from your own corpus, feed them to the model, and let it write the final answer in normal prose.

The concrete example is SF Symbols. Apple adds and renames symbols every year, and a local model will not keep up with that long tail or the way designers phrase requests. The flow is simple. The user asks for a symbol. A local search produces a shortlist. The model turns that shortlist into a clean reply. Everything stays local. For this demo we keep it simple and assume single-word queries like "share" or "paperplane"; the approach generalizes to longer phrasing when you switch to short-phrase embeddings and a slightly larger context.

<img src="/assets/2025-09-10/example.gif" width="90%"/>

## Where the vocabulary comes from

The SF Symbols app ships a plist that maps each symbol to several synonyms, if you have the app installed you can see it yourself at `/Applications/SF Symbols beta.app/Contents/Resources/Metadata/symbol_search.plist`.

We can start with direct string matching, it is fast and explainable, but as soon as queries hit natural phrasing it falls apart. "cat", "kitty", and "mister mittens" all point to the same thing, so exact match does not cut it for real users. That is why we reach out to embeddings. Embeddings place words and short phrases in a high dimensional space where similar items sit near each other. Cat and kitty end up close. Polysemy separates when we embed short phrases instead of single words, so "lock the door" lands far from "canal lock", that is exactly what symbol search needs.

## Build the indexes once and cache with a checksum

Creating embeddings is expensive, so do it once, persist it, and only rebuild when inputs or parameters change. Compute a checksum over the input files and over the knobs that affect retrieval quality. For symbols that means the synonyms plist plus the embedding model id, tokenization choices, BM25 parameters, and a schema version you bump on breaking changes. On launch compare the stored checksum to the one you compute now. If they match, load. If they do not, rebuild.

```swift
let checksum = SHA256.hash(data: Data.joined(files)).hex
if let idx = loadIndex(), idx.checksum == checksum { return idx }
let fresh = buildIndex(files)
saveIndex(Index(checksum: checksum, payload: fresh))
```

### Embedding index

We precompute one vector per symbol so queries stay fast. For each symbol, average the word‑level embeddings of its tokens and normalize.

```swift
guard let embedding = NLEmbedding.wordEmbedding(for: .english) else { return }

var symbolVectors: [String: [Double]] = [:]
for (symbol, tokens) in tokensBySymbol {
  let wordVectors = tokens.compactMap { embedding.vector(for: $0.lowercased()) }
  guard !wordVectors.isEmpty else { continue }
  symbolVectors[symbol] = normalize(average(wordVectors))
}
```

### BM25 index

We also precompute a sparse index for short queries. Each symbol is a tiny document containing its tokens.

```swift
func buildBM25Index(from tokensBySymbol: [String: Set<String>]) -> BM25Index {
  var docFreq = [String: Int]()
  var termFreqBySymbol = [String: [String: Int]]()
  var docLength = [String: Int]()
  var totalLength = 0

  for (symbol, tokens) in tokensBySymbol {
    docLength[symbol] = tokens.count
    totalLength += tokens.count

    var tf = [String: Int]()
    for t in tokens { tf[t] = 1; docFreq[t, default: 0] += 1 }
    termFreqBySymbol[symbol] = tf
  }

  let numDocs = tokensBySymbol.count
  let avgDocLength = numDocs > 0 ? Double(totalLength) / Double(numDocs) : 0
  return BM25Index(numDocs: numDocs,
                   avgDocLength: avgDocLength,
                   docFreq: docFreq,
                   termFreqBySymbol: termFreqBySymbol,
                   docLength: docLength)
}
```

## Embeddings path

We now reuse the `symbolVectors` we built in the “Embedding index” step. Each entry was produced by taking all tokens for a symbol (`tokensBySymbol[symbol]` combines the dot‑separated name parts plus its synonyms), looking up a word embedding for every token we can embed, averaging those vectors, then L2‑normalizing the result. At query time we do the exact same pipeline: tokenize → look up embeddings → average → normalize. Because both the query vector and every symbol vector are unit length, the dot product we compute in the snippet is identical to cosine similarity. We sort by that score and keep the top candidates.

```swift
guard let embedding = NLEmbedding.wordEmbedding(for: .english) else { return }

// Query → shortlist (symbolVectors is prebuilt)
let queryTokens  = tokenize(query)
let queryVectors = queryTokens.compactMap { embedding.vector(for: $0.lowercased()) }
guard !queryVectors.isEmpty else { return }
let queryVector = normalize(average(queryVectors))

let top = symbolVectors
  .map { (name: $0.key, score: dot(queryVector, $0.value)) }
  .sorted { $0.score > $1.score }
  .prefix(10)
```

## BM25 path

For short or exact queries ("cat", "lock", "paper") embeddings can smear differences, so we lean on the sparse BM25 index. It tracks four things: the tokens for each symbol (`tokensBySymbol`), for each token how many symbols contain it, whether a token appears in a given symbol (`termFreqBySymbol` giving a simple 0/1), and the symbol length plus the global average (`docLength` and `avgDocLength`) so longer synonym lists do not drown out concise ones.

Scoring is straightforward. We tokenize the query, deduplicate tokens, and ignore any that never show up in a symbol. Each remaining token gets a weight that rewards tokens that appear in few symbols and downweights those that show up everywhere. That weight is combined with simple presence and adjusted so longer synonym lists do not automatically outrank shorter, cleaner ones. We add up the contributions and clamp negative noise to zero. Net effect: an importance‑weighted token overlap that favors precise matches without letting verbose symbols dominate.

```swift
func bm25Score(for queryTokens: [String],
               in symbol: String,
               using index: BM25Index,
               k1: Double = 1.2,
               b: Double = 0.75) -> Double {
  guard index.numDocs > 0,
        let tf = index.termFreqBySymbol[symbol],
        let L = index.docLength[symbol] else { return 0 }

  let K = k1 * (1 - b + b * (Double(L) / max(index.avgDocLength, 1)))
  var score = 0.0
  for term in Set(queryTokens) {
    guard let df = index.docFreq[term], df > 0 else { continue }
    let idf = log((Double(index.numDocs - df) + 0.5) / (Double(df) + 0.5) + 1)
    let f = Double(tf[term] ?? 0); if f == 0 { continue }
    score += idf * ((f * (k1 + 1)) / (f + K))
  }
  return max(0, score)
}
```

## Hybrid retrieval

Here we fuse the two signals. We rescale the BM25 score for this query (divide by the best one so it lands near 1), keep the raw cosine (already in a tight range), then take a weighted mix. After that we layer tiny boosts for obvious matches: exact symbol name, substring hits, or a direct component in the dot‑separated name. Those nudges let clear intent win without drowning the semantic blend. Ties break in favor of simpler names so a noisy variant does not edge out the clean base symbol.

```swift
let alpha = 0.7
let cos = dot(qVec, v)
let bmNorm = bm25(sym) / (bm25Max + 1e-9)
let score = alpha * max(0, cos) + (1 - alpha) * bmNorm + nameBoost(sym, query)

func nameBoost(_ symbol: String, _ query: String) -> Double {
  let n = symbol.lowercased(), query = query.lowercased()
  if n == query { return 0.5 }
  if n.contains(query) { return 0.2 }
  if symbol.split(separator: ".").map(String.init).contains(query) { return 0.3 }
  return 0
}
```

The tool returns only symbol names, while the model writes the final text using those names and includes a tiny machine readable list so the UI can render previews in line with the message. That is the loop: a local model with a cutoff, a local index that keeps up with the symbol set, a quick lookup on device, and a reply that reads like a normal chat, no servers, no network calls.
