#!/bin/bash

CRM_GET_URL='https://citycondos.civicrm.org/civicrm/ajax/api4/Event/get'
# Set environment, never put in script to avoid accidentally committing.
CRM_AUTH="X-Civi-Auth: Bearer $CIVICRM_API_KEY"
CRM_UPDATE_URL='https://citycondos.civicrm.org/civicrm/ajax/api4/Event/update'

TEMPDIR=$(mktemp -d)
trap 'rm -r "$TEMPDIR"' EXIT

OFFSET=0

while true; do
  curl -X POST -H "$CRM_AUTH" -H "X-Civi-Key: $SITE_KEY" "$CRM_GET_URL" \
-d "params=%7B%22where%22%3A%5B%5B%22event_type_id%22%2C%22%3D%22%2C7%5D%5D%2C%22orderBy%22%3A%7B%22id%22%3A%22ASC%22%7D%2C%22limit%22%3A25%2C%22offset%22%3A$OFFSET%7D" > "$TEMPDIR/page.json"

  if [[ $(jq -r '.values|length' "$TEMPDIR/page.json") == 0 ]]; then
      echo "Done!"
      exit 0
  fi
  OFFSET=$((OFFSET + 25))
  IFS=$'\n'
  for REC in $(jq -c '.values[]|{id:.id,start_date:.start_date,registration_end: ((.start_date|strptime("%Y-%m-%d %H:%M:%S")|mktime)-3600*48)|strftime("%Y-%m-%d%%20%H%%3a%M%%3a%S")}' "$TEMPDIR/page.json"); do
      END=$(echo "$REC" | jq -r .registration_end);
      ID=$(echo "$REC" | jq -r .id);
      echo "$ID -> $END"

      curl -X POST -H "$CRM_AUTH" -H "X-Civi-Key: $SITE_KEY" "$CRM_UPDATE_URL" \
           -d "params=%7B%22values%22%3A%7B%22registration_end_date%22%3A%22$END%22%7D%2C%22where%22%3A%5B%5B%22id%22%2C%22%3D%22%2C$ID%5D%5D%7D"
  done
done
