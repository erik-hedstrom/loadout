#!/usr/bin/env sh
# Rebuilds the 1,262-skill library the v4 sweep ran against (bench/RESULTS.md).
# Revisions are those installed on 2026-10-06; `loadout add` takes each repo's
# current HEAD, so a rebuild today can differ slightly.
# Every source was added whole, except ComposioHQ/awesome-claude-skills: only
# its top-level specific skills were added (not composio-skills/, connectors,
# templates, or copies of anthropics/skills).
set -e
loadout add https://github.com/anthropics/knowledge-work-plugins   # 225 skills @ 8444efcd48f7
loadout add https://github.com/K-Dense-AI/scientific-agent-skills   # 177 skills @ 92ace75ac21e
loadout add https://github.com/google/skills   # 150 skills @ d6eee396ed6a
loadout add https://github.com/dotnet/skills   # 100 skills @ 6bd184d0347c
loadout add https://github.com/101-skills/superpowers   # 86 skills @ becc25649700
loadout add https://github.com/trailofbits/skills   # 85 skills @ 82fe82262526
loadout add https://github.com/openai/skills   # 44 skills @ 49f948faa925
loadout add https://github.com/mattpocock/skills   # 38 skills @ 4588b32ecab9
loadout add https://github.com/microsoft/azure-skills   # 38 skills @ 344bd5b3e041
loadout add https://github.com/prime-skills/runcomfy-agent-skills   # 30 skills @ fca19ae084c2
loadout add https://github.com/getsentry/skills   # 28 skills @ d18b7aa8ba87
loadout add https://github.com/larksuite/cli   # 28 skills @ 7beffb086d7f
loadout add https://github.com/huggingface/skills   # 26 skills @ ca0325bb20b2
loadout add https://github.com/addyosmani/agent-skills   # 25 skills @ 1401c8b8030e
loadout add https://github.com/juliusbrussee/caveman   # 22 skills @ 6571943370f7
loadout add https://github.com/heygen-com/hyperframes   # 21 skills @ 568dc2ae5bbc
loadout add https://github.com/anthropics/skills   # 19 skills @ 683bc88e56f3
loadout add https://github.com/cloudflare/skills   # 16 skills @ 41e0d1985894
loadout add https://github.com/obra/superpowers   # 15 skills @ 8ca22dba9a94
loadout add https://github.com/leonxlnx/taste-skill   # 13 skills @ ce26fc25c0e5
loadout add https://github.com/remotion-dev/skills   # 12 skills @ 473352613039
loadout add https://github.com/lllllllama/rigorpilot-skills   # 11 skills @ fb3ccdf5aa64
loadout add https://github.com/vercel-labs/agent-browser   # 10 skills @ 526157cfd4ec
loadout add https://github.com/vercel-labs/agent-skills   # 9 skills @ 063bee94c3f4
loadout add https://github.com/google/agents-cli   # 7 skills @ 2c3945901e8e
loadout add https://github.com/kepano/obsidian-skills   # 6 skills @ 3ccff5338ea7
loadout add https://github.com/supabase/agent-skills   # 2 skills @ c9be0e931b79
loadout add https://github.com/designed-by-ai/skills   # 1 skills @ 1c332ee9f385
loadout add https://github.com/flowkit-labs/skills   # 1 skills @ 0c9e2b63f504
loadout add https://github.com/pbakaus/impeccable   # 1 skills @ 0fd148c49724
loadout add https://github.com/vercel-labs/skills   # 1 skills @ 14cf84aa922c
loadout add https://github.com/ComposioHQ/awesome-claude-skills/tree/master/changelog-generator   # @ be2a406907db
loadout add https://github.com/ComposioHQ/awesome-claude-skills/tree/master/competitive-ads-extractor   # @ be2a406907db
loadout add https://github.com/ComposioHQ/awesome-claude-skills/tree/master/content-research-writer   # @ be2a406907db
loadout add https://github.com/ComposioHQ/awesome-claude-skills/tree/master/developer-growth-analysis   # @ be2a406907db
loadout add https://github.com/ComposioHQ/awesome-claude-skills/tree/master/domain-name-brainstormer   # @ be2a406907db
loadout add https://github.com/ComposioHQ/awesome-claude-skills/tree/master/file-organizer   # @ be2a406907db
loadout add https://github.com/ComposioHQ/awesome-claude-skills/tree/master/image-enhancer   # @ be2a406907db
loadout add https://github.com/ComposioHQ/awesome-claude-skills/tree/master/invoice-organizer   # @ be2a406907db
loadout add https://github.com/ComposioHQ/awesome-claude-skills/tree/master/langsmith-fetch   # @ be2a406907db
loadout add https://github.com/ComposioHQ/awesome-claude-skills/tree/master/lead-research-assistant   # @ be2a406907db
loadout add https://github.com/ComposioHQ/awesome-claude-skills/tree/master/meeting-insights-analyzer   # @ be2a406907db
loadout add https://github.com/ComposioHQ/awesome-claude-skills/tree/master/raffle-winner-picker   # @ be2a406907db
loadout add https://github.com/ComposioHQ/awesome-claude-skills/tree/master/tailored-resume-generator   # @ be2a406907db
loadout add https://github.com/ComposioHQ/awesome-claude-skills/tree/master/twitter-algorithm-optimizer   # @ be2a406907db
loadout add https://github.com/ComposioHQ/awesome-claude-skills/tree/master/video-downloader   # @ be2a406907db
