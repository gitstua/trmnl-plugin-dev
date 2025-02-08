# Find all directories containing config.toml
plugins=()
while IFS= read -r dir; do
    plugins+=("$(basename "$(dirname "$dir")")")
done < <(find ./_plugins -name "config.toml" -type f) 