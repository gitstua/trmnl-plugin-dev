# Find all directories containing settings.yml
plugins=()
while IFS= read -r dir; do
    plugins+=("$(basename "$(dirname "$dir")")")
done < <(find ./_plugins -name "settings.yml" -type f) 