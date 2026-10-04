"""
The ten TikTok photo-mode slideshows (3 Oct 2026), as data. render.py draws them.

Rules this file is checked against (render.py fails loudly on any break):
- TikTok only, 1080x1920, every text box above y 1500 and left of x 940.
- 5 to 8 slides, one idea per slide.
- 01 to 06 end with ONE text-only CTA slide; 07 to 10 never mention the app.
- No em or en dashes, never "beats", nothing that reads as meeting people
  (no "match", "swipe", "date", "partner").
- Every tip carries a source tag or a MY TAKE tag (opinion flagged as opinion).
- No game publisher visuals: backgrounds are Cameron's own photos and frames
  from his own raw takes, or designed Volt type backgrounds.

Text markup: *word* or *two words* is drawn in volt. Straight quotes and
apostrophes are turned into curly ones at draw time.

Background kinds:
  {"kind": "volt", "motif": "numeral" | "clock" | "lanes" | "plain" | "search" | "bookmark" | "send"}
  {"kind": "frame", "take": "<RAW take key>", "t": seconds}          a frame of his own video
  {"kind": "photo", "file": "IMG_xxxx.jpeg", "focus": (fx, fy), "zoom": z,
   "region": (x0, y0, x1, y1)}                                       his own photo, 9:16 crop
"""

# ---------------------------------------------------------------- sources
# Short tag printed on the slide -> full citation for sources.txt.
SOURCES = {
    "ERICSSON 1993": (
        "Ericsson, Krampe and Tesch-Romer (1993). The role of deliberate practice in the acquisition "
        "of expert performance. Psychological Review 100(3), 363-406. doi:10.1037/0033-295X.100.3.363. "
        "Deliberate practice = a well-defined goal, informative feedback, and repetition with error "
        "correction; it is set apart from play, which is done for enjoyment."
    ),
    "SAPIENZA ET AL. 2018": (
        "Sapienza, Zeng, Bessi, Lerman and Ferrara (2018). Individual performance in team-based online "
        "games. Royal Society Open Science 5: 180329. doi:10.1098/rsos.180329 (open access, PMC6030337). "
        "About 242,000 League solo-queue games played by 16,665 players (May 2014 to Jan 2016). A session = "
        "games with no more than a 15-minute break between them. Performance (win share and KDA) fell over "
        "a session, 'on average by 8-10% between the beginning and end of a session'; the effect is smaller "
        "for experienced players. Observational data."
    ),
    "RIOT SUPPORT, REPLAYS FAQ": (
        "Riot Games Support, League of Legends 'Replays FAQ & Pro-Tips' (page updated 27 Mar 2026), "
        "https://support.riotgames.com/en-us/league-of-legends/gameplay/replays-faq-pro-tips . "
        "'Replays last for the length of a patch cycle, meaning they'll expire once you patch up.' "
        "'Only the last 20 games are available on the client.' Number keys 1-5 (or Q,W,E,R,T) switch "
        "champions; press the same key twice to lock the camera."
    ),
    "LEAVITT ET AL., CHI 2016": (
        "Leavitt, Keegan and Clark (2016). Ping to Win? Non-Verbal Communication and Team Performance in "
        "Competitive Online Multiplayer Games. CHI 2016. doi:10.1145/2858036.2858132. 84,489 players across "
        "10,293 League games: pings have 'a positive but concave relationship with player performance' "
        "(more pings help, up to a point)."
    ),
    "MOEN ET AL. 2022": (
        "Moen, Vatn, Olsen, Haugan and Skalicka (2022). Sleep characteristics in esport players and "
        "associations with game performance. Frontiers in Sports and Active Living (PMC8794592). 27 CS:GO "
        "players; 'Better performing players slept more'. Average sleep onset 2:09 AM. Correlation, small sample."
    ),
    "WU ET AL., CHI 2021": (
        "Wu, Lee and Steinkuehler (2021). Understanding Tilt in Esports: A Study on Young League of Legends "
        "Players. CHI 2021. doi:10.1145/3411764.3445143. Survey of 95 high school League players: tilted "
        "'most commonly by their own teammates rather than opponents'; believing tilt can change led to "
        "more positive responses."
    ),
    "SMITHIES ET AL. 2024": (
        "Smithies, Toth and Campbell (2024). The Effect of Total Sleep Deprivation on the Cognitive and "
        "In-Game Performance of Rocket League Esport Players. Nature and Science of Sleep (PMC11669541). "
        "40 players, about 29 hours awake: reaction time about 48.61 ms slower and about 4.91x more lapses "
        "on a vigilance test, sleepier and less motivated, but in-game goal difference was NOT affected."
    ),
    "RIOT SUPPORT, CHAT COMMANDS": (
        "Riot Games Support, League of Legends 'Using Allied and All Chat' (updated 23 May 2025), "
        "https://support.riotgames.com/en-us/league-of-legends/gameplay/using-allied-and-all-chat . "
        "'/mute PlayerName will mute all text from a player for the duration of your current game'; "
        "/fullmute mutes text and pings."
    ),
    "LEAGUE WIKI, POSITIONS": (
        "League of Legends Wiki, 'Position' (https://wiki.leagueoflegends.com/en-us/Position): 'the bottom "
        "lane is shared by two players, the Bot Lane Carry is accompanied by a Support'; 'Mid laners operate "
        "in a solo lane at the center of the map'."
    ),
    "TAN ET AL., CHI PLAY 2022": (
        "Tan, Rogers, Nacke, Drachen and Wade (2022). Communication Sequences Indicate Team Cohesion: A "
        "Mixed-Methods Study of Ad Hoc League of Legends Teams. Proc. ACM HCI (CHI PLAY). doi:10.1145/3549488. "
        "48 teams (n=135). The high-cohesion team's chat ran apology -> encouragement and suggestion -> "
        "agree/acknowledge; the low-cohesion team's ran disagree -> disagree and frustration -> frustration. "
        "Cohesion mattered to team satisfaction whether or not the team won."
    ),
    "RIOT SUPPORT, RANKED QUEUES": (
        "Riot Games Support, 'Ranked Tiers, Divisions, and Queues' (updated 7 May 2026), "
        "https://support.riotgames.com/en-us/league-of-legends/gameplay/ranked-tiers-divisions-and-queues : "
        "'Since Solo/Duo is more focused on individual performance, there are limitations on who you can "
        "queue with.' Restrictions tighten at higher ranks."
    ),
    "LEAGUEOFLEGENDS.COM, HOW TO PLAY": (
        "leagueoflegends.com 'How to Play' (https://www.leagueoflegends.com/en-us/how-to-play/): Baron "
        "Nashor and the Drakes: 'Killing these units grants unique buffs for your team and can also turn "
        "the tide of the game.'"
    ),
}

# ---------------------------------------------------------------- backgrounds
# Raw takes, relative to C:\Users\stall\Videos\UGC. All of them are Cameron alone.
TAKES = {
    "ff15": "week-1/RAW - FF15.MOV",                 # black tee, "Sweet" cap, city window
    "solo": "week-1/RAW - Solo queue again.MOV",
    "friends": "week-2/RAW - Friends quit.MOV",      # white sweater, maroon cap, white room
    "launch": "week-1/RAW - Just launched.MOV",
    "cant": "week-2/RAW - Can't even queue.MOV",
    "climb": "week-2/RAW - Couldn't climb.MOV",
}

CTA_LINE = "Search *DuoQueue* on the App Store."
CTA_SMALL = "FREE ON IPHONE"

# ---------------------------------------------------------------- the slideshows
SLIDESHOWS = [
    # ------------------------------------------------------------------ 01
    {
        "id": "01", "folder": "01 Hardstuck habits", "theme": "games", "app": True,
        "hook_type": "pain point", "opener": "Here is the hard truth",
        "format": "photo hook + Volt type tips",
        "slides": [
            {"type": "hook", "label": "HERE IS THE HARD TRUTH",
             "head": "6 habits keeping you *hardstuck*",
             "sub": "Most of them feel normal.",
             "bg": {"kind": "frame", "take": "friends", "t": 75.6},
             "why": "You, looking straight at the camera, serious: fits a hard-truth opener."},
            {"type": "tip", "n": 1, "of": 6, "kicker": "HABIT",
             "head": "Queuing with no goal",
             "body": "Playing isn't practice. Practice has one clear goal and feedback.",
             "src": "ERICSSON 1993", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 2, "of": 6, "kicker": "HABIT",
             "head": "Six games in a row",
             "body": "In 242,000 solo queue games, players did 8 to 10% worse by the end of a session.",
             "src": "SAPIENZA ET AL. 2018", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 3, "of": 6, "kicker": "HABIT",
             "head": "Never watching a replay",
             "body": "League replays expire when the patch changes. Watch your last loss this week.",
             "src": "RIOT SUPPORT, REPLAYS FAQ", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 4, "of": 6, "kicker": "HABIT",
             "head": "Typing instead of pinging",
             "body": "In 10,293 League games, more pings went with better play, up to a point.",
             "src": "LEAVITT ET AL., CHI 2016", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 5, "of": 6, "kicker": "HABIT",
             "head": "Ranked at 2am",
             "body": "In a study of 27 CS:GO players, the better performers slept more.",
             "src": "MOEN ET AL. 2022",
             "bg": {"kind": "plate", "file": "IMG_2746.jpeg", "focus": (0.58, 0.52),
                    "region": (0.12, 0.395, 1.0, 0.92)},
             "why": "Your cat asleep on the desk by the keyboard (monitor cropped out): the sleep slide."},
            {"type": "tip", "n": 6, "of": 6, "kicker": "HABIT",
             "head": "Letting your team tilt you",
             "body": "95 high school League players said teammates tilt them more than opponents do.",
             "src": "WU ET AL., CHI 2021", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "cta", "q": "Fixing these is easier with a duo who's trying too.",
             "bg": {"kind": "volt", "motif": "search"}},
        ],
        "title": "6 habits keeping you hardstuck",
        "caption": "Which one are you guilty of? Sources are on every slide.",
        "tags": ["#soloqueue", "#rankedgrind", "#gamingtips", "#duoqueue", "#lfg"],
    },
    # ------------------------------------------------------------------ 02
    {
        "id": "02", "folder": "02 Review a game in 10 minutes", "theme": "games", "app": True,
        "hook_type": "promise of value", "opener": "Let me save you some time",
        "format": "all Volt type",
        "slides": [
            {"type": "hook", "label": "LET ME SAVE YOU SOME TIME",
             "head": "How to review a ranked game in *10 minutes*",
             "sub": "No coach needed.",
             "bg": {"kind": "volt", "motif": "clock"},
             "why": "A big 10:00 timer in the Volt type: the background is the promise."},
            {"type": "tip", "n": 1, "of": 6, "kicker": "STEP",
             "head": "Download it tonight",
             "body": "Replays expire when the patch changes, and the client keeps only your last 20 games.",
             "src": "RIOT SUPPORT, REPLAYS FAQ", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 2, "of": 6, "kicker": "STEP",
             "head": "Skip straight to your deaths",
             "body": "They're the easiest mistakes to find. Start there, not at minute one.",
             "take": True, "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 3, "of": 6, "kicker": "STEP",
             "head": "Rewind 10 seconds",
             "body": "Pause before each death. What did you know right then, and what did you ignore?",
             "take": True, "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 4, "of": 6, "kicker": "STEP",
             "head": "Lock the camera on you",
             "body": "Press your champion's number key twice and the replay camera follows you.",
             "src": "RIOT SUPPORT, REPLAYS FAQ", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 5, "of": 6, "kicker": "STEP",
             "head": "Write down *one* fix",
             "body": "Not five. Deliberate practice starts with one well-defined goal.",
             "src": "ERICSSON 1993", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 6, "of": 6, "kicker": "STEP",
             "head": "Next game, only fix that",
             "body": "Then check the next replay. Goal, feedback, repeat. That's the whole loop.",
             "src": "ERICSSON 1993", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "cta", "q": "Want a duo to review games with?",
             "bg": {"kind": "volt", "motif": "search"}},
        ],
        "title": "Review a ranked game in 10 minutes",
        "caption": "Do this once a night and you'll see your own patterns fast. Save it for later.",
        "tags": ["#gamingtips", "#soloqueue", "#rankedgrind", "#duoqueue", "#lfg"],
    },
    # ------------------------------------------------------------------ 03
    {
        "id": "03", "folder": "03 Stop queuing tonight", "theme": "games", "app": True,
        "hook_type": "insider info", "opener": "Nobody talks about this",
        "format": "photo hook + Volt type tips + one photo tip",
        "slides": [
            {"type": "hook", "label": "NOBODY TALKS ABOUT THIS",
             "head": "5 signs you should *stop queuing* tonight",
             "bg": {"kind": "frame", "take": "ff15", "t": 37.5},
             "why": "You, looking down, cap over your eyes: the after-a-loss slump the hook is about."},
            {"type": "tip", "n": 1, "of": 5, "kicker": "SIGN",
             "head": "You're 4+ games deep",
             "body": "In a big League study, performance kept dropping the longer a session ran.",
             "src": "SAPIENZA ET AL. 2018", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 2, "of": 5, "kicker": "SIGN",
             "head": "You're mad at your own team",
             "body": "In one survey of League players, teammates tilted them more than opponents did.",
             "src": "WU ET AL., CHI 2021", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 3, "of": 5, "kicker": "SIGN",
             "head": "It's way past bedtime",
             "body": "After a night with no sleep, players were about 49 ms slower on a reaction test.",
             "src": "SMITHIES ET AL. 2024", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 4, "of": 5, "kicker": "SIGN",
             "head": "You're typing more than playing",
             "body": "Mute it. In League, /mute or /fullmute a player for the rest of the game.",
             "src": "RIOT SUPPORT, CHAT COMMANDS", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 5, "of": 5, "kicker": "SIGN",
             "head": "You're saying *one more*",
             "body": "My rule: if I have to talk myself into it, I'm done for the night.",
             "take": True,
             "bg": {"kind": "plate", "file": "IMG_2820.jpeg", "focus": (0.55, 0.58), "region": (0.08, 0.30, 1.0, 0.92)},
             "why": "Your two cats on their tree looking out the window: stepping away for the night."},
            {"type": "tip", "n": None, "kicker": "BONUS",
             "head": "Tilt isn't fixed",
             "body": "Players who believed they could change how easily they tilt chose better ways to handle it.",
             "src": "WU ET AL., CHI 2021", "bg": {"kind": "volt", "motif": "plain"}},
            {"type": "cta", "q": "Want a duo who knows when to call it?",
             "bg": {"kind": "volt", "motif": "search"}},
        ],
        "title": "5 signs you should stop queuing tonight",
        "caption": "Which sign hits closest? Sources are on the slides.",
        "tags": ["#soloqueue", "#rankedgrind", "#gamingtips", "#duoqueue", "#lfg"],
    },
    # ------------------------------------------------------------------ 04
    {
        "id": "04", "folder": "04 Before you queue as a duo", "theme": "duo", "app": True,
        "hook_type": "insider info", "opener": "I wish somebody told me this sooner",
        "format": "all Volt type",
        "slides": [
            {"type": "hook", "label": "I WISH SOMEBODY TOLD ME THIS SOONER",
             "head": "5 things good duos agree on *before* they queue",
             "bg": {"kind": "volt", "motif": "lanes"},
             "why": "Two parallel lines, one volt and one ink: two players on the same plan."},
            {"type": "tip", "n": 1, "of": 5, "kicker": "AGREE ON",
             "head": "Roles that share the map",
             "body": "Bot carry and support share a lane, so all of laning is duo time.",
             "src": "LEAGUE WIKI, POSITIONS", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 2, "of": 5, "kicker": "AGREE ON",
             "head": "One goal for the night",
             "body": "Climb, learn a champ, or chill. Two different goals means two different games.",
             "take": True, "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 3, "of": 5, "kicker": "AGREE ON",
             "head": "A stop time",
             "body": "Performance drops the longer a session runs. Pick the time before game one.",
             "src": "SAPIENZA ET AL. 2018", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 4, "of": 5, "kicker": "AGREE ON",
             "head": "Ping first, type never",
             "body": "Across 10,293 League games, pinging went with better play, up to a point.",
             "src": "LEAVITT ET AL., CHI 2016", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 5, "of": 5, "kicker": "AGREE ON",
             "head": "Who calls the fights",
             "body": "One calls, the other says ok. That's how the close-knit team talked in a League study.",
             "src": "TAN ET AL., CHI PLAY 2022", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "cta", "q": "Need a duo who actually wants to climb?",
             "bg": {"kind": "volt", "motif": "search"}},
        ],
        "title": "5 things good duos agree on before they queue",
        "caption": "Two minutes in the lobby saves a lot of arguing later.",
        "tags": ["#duoqueue", "#rankedgrind", "#gamingtips", "#soloqueue", "#lfg"],
    },
    # ------------------------------------------------------------------ 05
    {
        "id": "05", "folder": "05 Best duo role combos", "theme": "duo", "app": True,
        "hook_type": "surprise (opinion)", "opener": "You might disagree",
        "format": "photo hook + Volt type ranking",
        "slides": [
            {"type": "hook", "label": "YOU MIGHT DISAGREE",
             "head": "The best duo role combos, *ranked*",
             "sub": "My take. Tell me yours.", "ramp": 260,
             "bg": {"kind": "frame", "take": "friends", "t": 33.0},
             "why": "You, with a hand over your mouth, side-eye: a you-might-disagree face."},
            {"type": "tip", "n": 1, "kicker": "RANK", "rank": "#1",
             "head": "Bot carry + support",
             "body": "You share a lane, so you play together from the first minute.",
             "src": "LEAGUE WIKI, POSITIONS", "take": True, "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 2, "kicker": "RANK", "rank": "#2",
             "head": "Jungle + mid",
             "body": "Mid is the center of the map, so your jungler is never far away.",
             "src": "LEAGUE WIKI, POSITIONS", "take": True, "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 3, "kicker": "RANK", "rank": "#3",
             "head": "Jungle + support",
             "body": "Once bot lane is stable, the two of you can move around the map together.",
             "take": True, "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 4, "kicker": "RANK", "rank": "#4",
             "head": "Top + jungle",
             "body": "Top is the loneliest lane. A jungler who plans with you changes that.",
             "take": True, "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": None, "kicker": "RANK", "rank": "LAST",
             "head": "Two people who both need the gold",
             "body": "Two carries fighting over farm usually means neither of you carries.",
             "take": True, "bg": {"kind": "volt", "motif": "plain"}},
            {"type": "cta", "q": "Need a duo who actually wants to climb?",
             "bg": {"kind": "volt", "motif": "search"}},
        ],
        "title": "Best duo role combos, ranked (my take)",
        "caption": "Tell me what I got wrong. This is opinion, not a tier list.",
        "tags": ["#duoqueue", "#gamingtips", "#rankedgrind", "#soloqueue", "#lfg"],
    },
    # ------------------------------------------------------------------ 06
    {
        "id": "06", "folder": "06 Check these before you duo", "theme": "duo", "app": True,
        "hook_type": "pain point", "opener": "Stop scrolling for a second",
        "format": "photo hook + Volt type tips",
        "slides": [
            {"type": "hook", "label": "STOP SCROLLING FOR A SECOND",
             "head": "Check these 5 things before you *duo* with someone",
             "bg": {"kind": "frame", "take": "solo", "t": 20.0},
             "why": "You, mid-sentence, talking to camera: a direct stop-scrolling opener."},
            {"type": "tip", "n": 1, "of": 5, "kicker": "CHECK",
             "head": "Same goal for ranked",
             "body": "If you want to climb and they want to chill, somebody ends up annoyed.",
             "take": True, "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 2, "of": 5, "kicker": "CHECK",
             "head": "Ranks close enough to queue",
             "body": "Riot limits which ranks can duo in Solo/Duo, and it gets tighter as you climb.",
             "src": "RIOT SUPPORT, RANKED QUEUES", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 3, "of": 5, "kicker": "CHECK",
             "head": "Roles that fit yours",
             "body": "Carry and support share bot lane. Two mid mains can't both play mid.",
             "src": "LEAGUE WIKI, POSITIONS", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 4, "of": 5, "kicker": "CHECK",
             "head": "They say *my bad*",
             "body": "In a League study, the close-knit team answered apologies with encouragement.",
             "src": "TAN ET AL., CHI PLAY 2022", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 5, "of": 5, "kicker": "CHECK",
             "head": "They know when to stop",
             "body": "Long sessions go worse. A duo who says last one and means it is gold.",
             "src": "SAPIENZA ET AL. 2018", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "cta", "q": "Looking for a duo like that?",
             "bg": {"kind": "volt", "motif": "search"}},
        ],
        "title": "Check these 5 things before you duo with someone",
        "caption": "Rank is the least important one on this list.",
        "tags": ["#duoqueue", "#lfg", "#rankedgrind", "#soloqueue", "#gamingtips"],
    },
    # ------------------------------------------------------------------ 07
    {
        "id": "07", "folder": "07 Playing more isn't practice", "theme": "games", "app": False,
        "hook_type": "surprise", "opener": "This might surprise you",
        "format": "photo hook + Volt type tips",
        "slides": [
            {"type": "hook", "label": "THIS MIGHT SURPRISE YOU",
             "head": "Playing more games isn't the same as *practice*",
             "bg": {"kind": "plate", "file": "IMG_2557.jpeg", "focus": (0.55, 0.55), "region": (0.0, 0.05, 1.0, 0.95)},
             "why": "Your orange cat staring into the lens, unimpressed: a this-might-surprise-you look."},
            {"type": "tip", "n": 1, "of": 5, "kicker": "STEP",
             "head": "Know the difference",
             "body": "Research on experts splits play from deliberate practice. Only one is built to improve you.",
             "src": "ERICSSON 1993", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 2, "of": 5, "kicker": "STEP",
             "head": "Pick *one* goal per game",
             "body": "Example: no deaths before 10 minutes. Or ping every time your laner goes missing.",
             "take": True, "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 3, "of": 5, "kicker": "STEP",
             "head": "Get feedback the same night",
             "body": "Watch that one thing in the replay. Replays expire when the patch changes.",
             "src": "RIOT SUPPORT, REPLAYS FAQ", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 4, "of": 5, "kicker": "STEP",
             "head": "Repeat it until it's boring",
             "body": "Repetition with fixes is what turns a goal into a habit.",
             "src": "ERICSSON 1993", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 5, "of": 5, "kicker": "STEP",
             "head": "Stop while you're sharp",
             "body": "In 242,000 solo queue games, performance fell 8 to 10% by the end of a session.",
             "src": "SAPIENZA ET AL. 2018", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "close", "head": "Save this for your next session.",
             "sub": "PICK YOUR ONE GOAL BEFORE YOU QUEUE", "bg": {"kind": "volt", "motif": "bookmark"}},
        ],
        "title": "Playing more games isn't the same as practice",
        "caption": "What's your one goal for tonight? Sources are on the slides.",
        "tags": ["#gamingtips", "#rankedgrind", "#soloqueue", "#lfg"],
    },
    # ------------------------------------------------------------------ 08
    {
        "id": "08", "folder": "08 Worse at 2am", "theme": "games", "app": False,
        "hook_type": "insider info", "opener": "Have you ever noticed",
        "format": "photo on every slide",
        "slides": [
            {"type": "hook", "label": "HAVE YOU EVER NOTICED",
             "head": "you play *worse* at 2am?",
             "sub": "Here's what the research says.",
             "bg": {"kind": "plate", "file": "IMG_2746.jpeg", "focus": (0.58, 0.52),
                    "region": (0.12, 0.395, 1.0, 0.92)},
             "why": "Your cat asleep on the gaming desk (monitor cropped out): the 2am hook."},
            {"type": "tip", "n": 1, "of": 5, "kicker": "FACT", "photo_text": True,
             "head": "Better players slept more",
             "body": "In a 2022 study of 27 CS:GO players, the better performers got more sleep.",
             "src": "MOEN ET AL. 2022", "bg": {"kind": "frame", "take": "ff15", "t": 30.6},
             "why": "You, thinking, hand on chin: reading the research."},
            {"type": "tip", "n": 2, "of": 5, "kicker": "FACT", "photo_text": True,
             "head": "Their average bedtime: 2:09am",
             "body": "Same study. On average they slept less than athletes are told to.",
             "src": "MOEN ET AL. 2022", "bg": {"kind": "frame", "take": "solo", "t": 2.3},
             "why": "You, hand on chin, side look: the 'yeah, that's me' moment."},
            {"type": "tip", "n": 3, "of": 5, "kicker": "FACT", "photo_text": True,
             "head": "One all-nighter: 49 ms slower",
             "body": "Rocket League players kept up 29 hours reacted slower and zoned out about 5x more.",
             "src": "SMITHIES ET AL. 2024", "bg": {"kind": "frame", "take": "launch", "t": 57.5},
             "why": "You, looking down, worn out: an all-nighter."},
            {"type": "tip", "n": 4, "of": 5, "kicker": "FACT", "photo_text": True,
             "head": "Their game results held up",
             "body": "The honest part: they just felt sleepier and less motivated. Sleep alone won't carry you.",
             "src": "SMITHIES ET AL. 2024", "bg": {"kind": "frame", "take": "climb", "t": 115.0},
             "why": "You, weighing it up, hand on chin: the honest caveat."},
            {"type": "tip", "n": 5, "of": 5, "kicker": "FACT", "photo_text": True,
             "head": "Long sessions go worse",
             "body": "In a big League study, performance kept dropping the longer a session ran.",
             "src": "SAPIENZA ET AL. 2018",
             "bg": {"kind": "plate", "file": "IMG_2820.jpeg", "focus": (0.55, 0.58), "region": (0.08, 0.30, 1.0, 0.92)},
             "why": "Your cats on the tree at the window in daylight: the day you could be having."},
            {"type": "close", "head": "Set a stop time before game one.",
             "sub": "MY TAKE. SAVE THIS FOR TONIGHT", "bg": {"kind": "plate", "file": "IMG_2746.jpeg",
                    "focus": (0.52, 0.48), "zoom": 1.3, "region": (0.12, 0.395, 1.0, 0.92)},
             "why": "Back to the sleeping cat: go to bed."},
        ],
        "title": "Have you ever noticed you play worse at 2am?",
        "caption": "Slide 5 is the honest part. What time do you usually stop?",
        "tags": ["#gamingtips", "#rankedgrind", "#soloqueue", "#lfg"],
    },
    # ------------------------------------------------------------------ 09
    {
        "id": "09", "folder": "09 After a loss with your duo", "theme": "duo", "app": False,
        "hook_type": "promise of value", "opener": "You need to hear this",
        "format": "photo hook + Volt type tips",
        "slides": [
            {"type": "hook", "label": "YOU NEED TO HEAR THIS",
             "head": "What to say to your duo *after a loss*",
             "bg": {"kind": "frame", "take": "launch", "t": 2.5},
             "why": "You, straight to camera, calm: a you-need-to-hear-this talk."},
            {"type": "tip", "n": 1, "of": 5, "kicker": "STEP",
             "head": "Know who tilts you",
             "body": "In a survey of 95 League players, teammates tilted them more than opponents.",
             "src": "WU ET AL., CHI 2021", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 2, "of": 5, "kicker": "STEP",
             "head": "Don't start the loop",
             "body": "In a League study, the low-cohesion team went disagree, disagree. Frustration, frustration.",
             "src": "TAN ET AL., CHI PLAY 2022", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 3, "of": 5, "kicker": "STEP",
             "head": "Apologize, then encourage",
             "body": "The close-knit team did this: an apology, then encouragement right after.",
             "src": "TAN ET AL., CHI PLAY 2022", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 4, "of": 5, "kicker": "STEP",
             "head": "Use this script",
             "body": "\"My bad on that fight.\"\n\"All good, we got the next one.\"",
             "take": True, "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 5, "of": 5, "kicker": "STEP",
             "head": "It matters win or lose",
             "body": "Teams that stuck together enjoyed it more, separate from the result.",
             "src": "TAN ET AL., CHI PLAY 2022", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "close", "head": "Send this to your duo.",
             "sub": "BEFORE YOUR NEXT LOSS, NOT AFTER", "bg": {"kind": "volt", "motif": "send"}},
        ],
        "title": "What to say to your duo after a loss",
        "caption": "Step 2 is the hardest one. Sources on the slides.",
        "tags": ["#gamingtips", "#rankedgrind", "#soloqueue", "#lfg"],
    },
    # ------------------------------------------------------------------ 10
    {
        "id": "10", "folder": "10 Calls every duo should make", "theme": "duo", "app": False,
        "hook_type": "promise of value", "opener": "I just realized something",
        "format": "photo hook + Volt type tips",
        "slides": [
            {"type": "hook", "label": "I JUST REALIZED SOMETHING",
             "head": "Your duo can't read your mind.\n*Make these 5 calls.*",
             "bg": {"kind": "frame", "take": "cant", "t": 110.0},
             "why": "You, close up, looking off to the side: an I-just-realized moment."},
            {"type": "tip", "n": 1, "of": 5, "kicker": "CALL",
             "head": "\"I'm going here next\"",
             "body": "Say the plan, not the mistake. Then your duo can just say ok.",
             "src": "TAN ET AL., CHI PLAY 2022", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 2, "of": 5, "kicker": "CALL",
             "head": "Objective timers",
             "body": "Drakes and Baron can turn the tide of a game. Call them before they spawn.",
             "src": "LEAGUEOFLEGENDS.COM, HOW TO PLAY", "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 3, "of": 5, "kicker": "CALL",
             "head": "\"Missing\"",
             "body": "Ping it the second your lane opponent disappears.",
             "take": True, "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 4, "of": 5, "kicker": "CALL",
             "head": "\"Back together\"",
             "body": "Reset at the same time so you both come back with items.",
             "take": True, "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "tip", "n": 5, "of": 5, "kicker": "CALL",
             "head": "\"Go\" or \"no\"",
             "body": "One person makes the final call in a fight. Argue after the game, not during.",
             "take": True, "bg": {"kind": "volt", "motif": "numeral"}},
            {"type": "close", "head": "Save this for your next duo session.",
             "sub": "WHICH CALL DO YOU NEVER MAKE?", "bg": {"kind": "volt", "motif": "bookmark"}},
        ],
        "title": "5 calls every duo should make",
        "caption": "Which one does your duo never say?",
        "tags": ["#gamingtips", "#rankedgrind", "#soloqueue", "#lfg"],
    },
]
