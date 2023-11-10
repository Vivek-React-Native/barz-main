#!/bin/bash
source .env
mkdir -p .local-object-storage/beats
mkdir -p .local-object-storage/recordings/{raw,encoded}

# Copy demo audio file into the mock local object store
echo "* Copying sample_quiet.mp3 into local object storage..."
cp fixtures/beats/sample_quiet.mp3 .local-object-storage/beats/

# Add initial beat row into the database
echo "* Adding initial beat row into database..."
docker exec -it db psql $DATABASE_URL -c "
INSERT INTO battle_beat
  (id, updated_at, beat_key, enabled)
  VALUES ('cliomen980000pkbdhsn1vbbz', NOW(), 'sample_quiet.mp3', true);
"

echo "* Done!"
