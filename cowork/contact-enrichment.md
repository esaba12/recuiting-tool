# Cowork Task: Weekly Contact Enrichment
# Usage: On-demand (weekly, ideally Sunday afternoon before the weekly memo runs)
# Queries Notion for unchecked contacts, enriches via Exa, writes LinkedIn URLs back

Query my Notion Contacts DB for all rows where the "Exa Enriched" checkbox is unchecked.

For each contact in that list:
1. Search Exa for "[Name] [Company] LinkedIn"
2. If you find a confident match (the LinkedIn profile shows the same company or a plausible career path):
   - Write the LinkedIn URL to their LinkedIn property in Notion
   - Check their "Exa Enriched" checkbox
3. If you cannot find a confident match (common name, no result, wrong company):
   - Do NOT write any URL
   - Do NOT check the box
   - Add their name to your "could not find" list

After processing all contacts, report:
- How many contacts were enriched (with LinkedIn URLs found)
- How many you could not find (list their names)
- Any cases where you found multiple possible profiles and chose one (explain why)

Process them all in one session. If there are more than 20 unchecked contacts, process the 20 most recently added first (newest Last Interaction date).
