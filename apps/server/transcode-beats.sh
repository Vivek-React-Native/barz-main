#!/bin/bash

input_dir="$1"
output_dir="$(pwd)/beats-output";

if [ -d "$output_dir" ]; then
  echo "Output directory $output_dir already exists. Press enter to delete and overwrite all files inside."
  read
  rm -rf "$output_dir"
fi
mkdir -p "$output_dir"

for input_file in $(ls $1); do
  output_file="$(echo "$input_file" | sed 's/wav/mp3/g')"
  echo "Processing $input_file:"
  ffmpeg -i "$input_dir/$input_file" -format mp3 "$output_dir/$output_file"
done

echo "Output files in $output_dir"
