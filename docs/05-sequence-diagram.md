# Sequence diagram

```mermaid
sequenceDiagram
    actor U as Person
    participant S as Search.jsx
    participant A as App.jsx
    participant E as embed.js (in the browser)
    participant R as rank.js
    participant C as Card.jsx

    Note over A,E: page opens: loadModel() starts downloading<br/>the 8-bit model, 15.6MB, once

    U->>S: types "alien movies", presses Search
    S->>A: runSearch("alien movies")
    A->>A: setSearching(true)

    A->>E: loadModel(setLoadingProgress)
    Note over S,E: only if still downloading:<br/>the button fills as it loads
    E-->>A: model ready

    A->>E: embed("alien movies")
    Note over E: tokenize<br/>transformers.js, ONNX model<br/>mean pool, normalise<br/>PCA 384 to 192, normalise
    E-->>A: 192 numbers

    A->>A: setQuery(v)<br/>clear ratings, round saves, seen
    A->>R: scoreAll({ vecs, masks, films, query: v })

    loop each of 7 fields
        R->>R: tasteFor(field) = query + liked + saved − disliked
        R->>R: scoreField, 4,999 dot products
        R->>R: confidence = mean of top 10 − median
    end

    R->>R: autoWeights, softmax at temperature 0.1
    R->>R: capWeights, nothing over 0.35
    R->>R: combine 7 scores into 1 per film
    R->>R: multiply by 1 + 0.5 × quality
    R-->>A: 4,999 scores

    A->>A: sort, drop seen and marked, take 48
    A->>C: render 48 cards
    C-->>U: the grid, with Rise

    U->>C: marks a few films
    C->>A: rate(i, "up") / toggleSave(i)

    U->>A: presses Refresh
    A->>R: scoreAll, same query, new marks
    Note over A,R: no model call, about 15ms
    R-->>A: new scores
    A->>C: render the next 48
```
