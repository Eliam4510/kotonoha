<p align="right"><a href="costos.md">Español</a> · <b>English</b> · <a href="de/costs.md">Deutsch</a> · <a href="zh/costs.md">简体中文</a> · <a href="ko/costs.md">한국어</a> · <a href="ja/costs.md">日本語</a></p>

# Claude API costs

What it costs to use Kotonoha with a personal Claude API key, measured with real videos on November 5, 2026. The **Claude spending** card on the home screen shows the exact usage of each installation, with the tokens reported by the API.

Subtitles, the dictionary, furigana, flashcards, review and Whisper transcription do not use the API and cost nothing.

## Summary

With a reference credit of USD 100 a month:

| Video use | Cost per hour | Hours a month with USD 100 |
|---|---|---|
| Automatic subtitles, with correction, review and translation | USD 1.39 | 62 |
| Automatic subtitles, with correction and review | USD 1.00 | 82 |
| Manual subtitles, with review and translation | USD 0.75 | 104 |
| Manual subtitles, with review | USD 0.36 | 175 |

The hours in the last column include 30 word queries per hour of video. Watching a video again costs nothing, because reviewed, corrected and translated lines stay stored.

## Measurements

Each cost comes from the Claude Console balance before and after the operation, with the default models and effort levels. The balance has a resolution of one cent, so each figure has a margin of ±USD 0.01.

| Operation | Video | Measured cost |
|---|---|---|
| Review of readings, meanings and grammar | 6:41, manual subtitles | USD 0.04 |
| Correction and review | 10:46, automatic subtitles, 154 lines | USD 0.18 |
| Translation into Spanish | The same video, 150 lines | USD 0.07 |
| Meaning in the sentence, with the full script as context | 5 words | USD 0.03 |

This gives the following rates per hour of video. Correction comes from subtracting the review from the second measurement.

| Task | Per hour of video | Per 10 minutes |
|---|---|---|
| Correction of automatic subtitles | USD 0.64 | USD 0.11 |
| Translation | USD 0.39 | USD 0.07 |
| Review of readings, meanings and grammar | USD 0.36 | USD 0.06 |

The cost depends on how much is said. These videos have about 14 lines per minute, and a video with more dialogue costs proportionally more.

### Word queries

| Query | Approximate cost | Source |
|---|---|---|
| Opening a word: dictionary | USD 0 | Makes no request |
| Coming back to a word already asked about in that sentence | USD 0 | Served from storage |
| What does it mean in this sentence? | USD 0.006 | Measured, and an upper bound: the measurement includes the full script |
| Explain, break down | USD 0.01 | Estimated from tokens |
| Translate a sentence | USD 0.002 | Estimated from tokens |
| Go deeper, with Opus 5.5 | USD 0.06 | Estimated from tokens |
| Creating a card with a Claude translation and explanation | USD 0.012 | Estimated from tokens. It can be turned off in Settings, Cards and Anki |

## Per video

| Video | Without translation | With translation |
|---|---|---|
| 20-minute YouTube video, automatic subtitles | USD 0.33 | USD 0.46 |
| 24-minute episode, manual subtitles | USD 0.14 | USD 0.30 |
| 2-hour film, manual subtitles | USD 0.72 | USD 1.50 |

## Per month

With automatic subtitles, translation and 30 word queries per hour of video:

| Use | Hours a month | Video | Queries | Total | Of the USD 100 credit |
|---|---|---|---|---|---|
| 20 minutes a day | 10 | USD 13.90 | USD 2.10 | USD 16 | 16 % |
| 1 hour a day | 30 | USD 41.70 | USD 6.30 | USD 48 | 48 % |
| 2 hours a day | 60 | USD 83.40 | USD 12.60 | USD 96 | 96 % |
| 3 hours a day | 90 | USD 125.10 | USD 18.90 | USD 144 | Exceeded |

With manual subtitles and no translation, because the video already has them in Spanish:

| Use | Hours a month | Video | Queries | Total | Of the USD 100 credit |
|---|---|---|---|---|---|
| 1 hour a day | 30 | USD 10.80 | USD 6.30 | USD 17 | 17 % |
| 3 hours a day | 90 | USD 32.40 | USD 18.90 | USD 51 | 51 % |

## Prices

Prices per million tokens, in dollars. The model's reasoning is billed as output.

| Model | Input | Output | Cache read | Cache write, 5 min | Cache write, 1 h |
|---|---|---|---|---|---|
| Claude Sonnet 5.5 | 2 | 10 | 0.20 | 2.50 | 4 |
| Claude Opus 5.5 | 4 | 20 | 0.20 | 5 | 8 |
| Claude Haiku 5.5 | 0.10 | 0.50 | 0.01 | 0.125 | 0.20 |

## How spending is avoided

| Measure | Effect |
|---|---|
| The word panel opens with the dictionary | Hovering over a word no longer makes any request |
| Every answer is stored for 90 days, by word and sentence | Moving between words, or coming back to the same video, costs nothing |
| A request in flight is not cancelled | Changing word does not throw away what is already paid for: it finishes, is stored and stays available |
| Two identical queries at once share one request | Impatience is not paid for twice |
| The review advances with the video | Giving up on a film after 10 minutes does not cost the whole film |
| The full script is optional for queries | Each query sends 40 lines of context, not the whole video |

## How to spend less

| Setting | Where | Saving per hour of video |
|---|---|---|
| Translate only when needed | Generate subtitles | USD 0.39 |
| Do not review as the video advances | Generate subtitles | USD 0.36 |
| Do not correct automatic subtitles on opening | Generate subtitles | USD 0.64 |
| A smaller model or effort per task | Settings, Claude | Depends on the task, and may affect quality |

The first three can still be requested with their button on any video of interest.
