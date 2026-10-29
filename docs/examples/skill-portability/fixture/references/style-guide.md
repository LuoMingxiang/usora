# Release notes output contract

Write a JSON object with exactly these four keys:

- `format`: the string `portable-release-notes-v1`
- `added`: changes whose `type` is `feat`
- `fixed`: changes whose `type` is `fix`
- `documentation`: changes whose `type` is `docs`

Each group is an array of objects with exactly `id` and `summary` string keys.
Sort each array by ID in ascending lexicographic order. Preserve the original
summary verbatim. Unsupported change types are an error; report them instead of
inventing a category.
