import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Users,
  Shuffle,
  Play,
  RotateCcw,
  Award,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Swords,
  ListOrdered,
  UserPlus,
  AlertCircle,
  Plus,
  Minus
} from 'lucide-react';

// Sample names for quick auto-fill
const SAMPLE_NAMES = [
  "Alex Rivera", "Jordan Lee", "Taylor Kim", "Morgan Vance",
  "Casey Chen", "Riley Brooks", "Jamie Patel", "Quinn Murphy",
  "Avery Cruz", "Dakota Reyes", "Skyler Santos", "Cameron Diaz",
  "Reese Navarro", "Rowan Gomez", "Finley Torres", "Hayden Silva",
  "Emerson Ortiz", "Parker Ramos", "Sawyer Morales", "Peyton Castro",
  "Blake Mendoza", "Charlie Flores", "Drew Bautista", "Elliot Aquino",
  "Logan Reed", "Morgan Fox", "Jesse James", "Sammy Davis",
  "Pat Smith", "Chris Taylor", "Terry Johnson", "Robin Hood"
];

export default function App() {
  // Navigation & Stage State: 'setup' | 'qualifying' | 'semis' | 'championship'
  const [stage, setStage] = useState('setup');
  const [errorMsg, setErrorMsg] = useState('');

  // Setup configuration state:
  const [totalPlayers, setTotalPlayers] = useState(24);
  const [matchesPerTeam, setMatchesPerTeam] = useState(5);

  // Player Inputs array
  const [playerInputs, setPlayerInputs] = useState(Array(24).fill(''));

  // Stage 1: Teams & Qualifying Schedule
  const [teams, setTeams] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [activeRoundTab, setActiveRoundTab] = useState(1);

  // Stage 2: Semifinals
  const [top4Teams, setTop4Teams] = useState([]);
  const [semiA, setSemiA] = useState({
    team1: { p1: '', p2: '', label: 'Top 1A & Top 2A' },
    team2: { p1: '', p2: '', label: 'Top 3A & Top 4A' },
    score1: '',
    score2: ''
  });
  const [semiB, setSemiB] = useState({
    team1: { p1: '', p2: '', label: 'Top 1B & Top 2B' },
    team2: { p1: '', p2: '', label: 'Top 3B & Top 4B' },
    score1: '',
    score2: ''
  });

  // Stage 3: Championship
  const [finalistsA, setFinalistsA] = useState([]); // [p1, p2] from Semi A
  const [finalistsB, setFinalistsB] = useState([]); // [p1, p2] from Semi B
  const [champMatch, setChampMatch] = useState({
    team1: { playerA: '', playerB: '' },
    team2: { playerA: '', playerB: '' },
    score1: '',
    score2: ''
  });

  // --- HANDLER: Changing Total Players Count ---
  const handlePlayerCountChange = (newCount) => {
    if (newCount < 4 || newCount > 32 || newCount % 2 !== 0) return;
    setTotalPlayers(newCount);
    
    setPlayerInputs(prev => {
      if (newCount > prev.length) {
        return [...prev, ...Array(newCount - prev.length).fill('')];
      } else {
        return prev.slice(0, newCount);
      }
    });

    const newNumTeams = newCount / 2;
    const maxAllowed = newNumTeams - 1;
    if (matchesPerTeam > maxAllowed) {
      setMatchesPerTeam(Math.max(1, maxAllowed));
    }
    setErrorMsg('');
  };

  // --- HELPER: Fisher-Yates Shuffle ---
  const shuffleArray = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // --- HELPER: Random Non-Tied Score Generator ---
  const generateRandomScores = (min = 11, max = 21) => {
    const s1 = Math.floor(Math.random() * (max - min + 1)) + min;
    let s2 = Math.floor(Math.random() * (max - min + 1)) + min;
    while (s2 === s1) {
      s2 = Math.floor(Math.random() * (max - min + 1)) + min;
    }
    return [String(s1), String(s2)];
  };

  // --- SETUP ACTIONS ---
  const handleAutoFill = () => {
    const filled = Array(totalPlayers).fill('').map((_, i) => SAMPLE_NAMES[i % SAMPLE_NAMES.length]);
    setPlayerInputs(filled);
    setErrorMsg('');
  };

  const handleClearInputs = () => {
    setPlayerInputs(Array(totalPlayers).fill(''));
    setErrorMsg('');
  };

  const handlePlayerChange = (index, value) => {
    const updated = [...playerInputs];
    updated[index] = value;
    setPlayerInputs(updated);
    if (errorMsg) setErrorMsg('');
  };

  const startTournament = () => {
    const cleaned = playerInputs.map((p, idx) => p.trim() || `Player ${String(idx + 1).padStart(2, '0')}`);
    const uniqueCheck = new Set(cleaned.map(n => n.toLowerCase()));
    if (uniqueCheck.size !== totalPlayers) {
      setErrorMsg(`Please ensure all ${totalPlayers} player names are unique so teammates can be tracked accurately.`);
      return;
    }

    const numTeams = totalPlayers / 2;
    const maxMatches = numTeams - 1;
    if (matchesPerTeam < 1 || matchesPerTeam > maxMatches) {
      setErrorMsg(`Matches per team must be between 1 and ${maxMatches} for ${numTeams} teams.`);
      return;
    }

    // 1. Randomize players into teams
    const shuffled = shuffleArray(cleaned);
    const createdTeams = [];
    for (let i = 0; i < totalPlayers; i += 2) {
      const num = i / 2 + 1;
      createdTeams.push({
        id: `T${num}`,
        name: `Team ${String(num).padStart(2, '0')}`,
        playerA: shuffled[i],
        playerB: shuffled[i + 1]
      });
    }

    // 2. Randomized Scheduling with No-Repeat Opponent Constraints
    const generatedRounds = [];
    const oppositionHistory = {}; // Tracks team IDs each team has already played against
    createdTeams.forEach(t => { oppositionHistory[t.id] = new Set(); });

    let scheduleFailed = false;

    for (let r = 1; r <= matchesPerTeam; r++) {
      const matches = [];
      let availableTeams = shuffleArray([...createdTeams]);
      let roundValid = false;
      let attempts = 0;

      // Backtracking / retrying mechanism for the round if pairing deadlocks
      while (!roundValid && attempts < 100) {
        attempts++;
        availableTeams = shuffleArray([...createdTeams]);
        const currentRoundPairs = [];
        const matchedInThisRound = new Set();
        let failed = false;

        while (availableTeams.length > 0) {
          const t1 = availableTeams.pop();
          if (matchedInThisRound.has(t1.id)) continue;

          // Find eligible opponents that haven't played t1 yet
          const eligibleOpponents = availableTeams.filter(
            t2 => !matchedInThisRound.has(t2.id) && !oppositionHistory[t1.id].has(t2.id)
          );

          if (eligibleOpponents.length === 0) {
            failed = true;
            break; // Deadlock, retry shuffling available pool
          }

          // Pick a random valid opponent
          const t2 = eligibleOpponents[Math.floor(Math.random() * eligibleOpponents.length)];
          
          matchedInThisRound.add(t1.id);
          matchedInThisRound.add(t2.id);
          currentRoundPairs.push({ t1, t2 });
        }

        if (!failed && currentRoundPairs.length === numTeams / 2) {
          roundValid = true;
          currentRoundPairs.forEach((pair, idx) => {
            const { t1, t2 } = pair;
            oppositionHistory[t1.id].add(t2.id);
            oppositionHistory[t2.id].add(t1.id);

            matches.push({
              id: `R${r}-M${idx + 1}`,
              round: r,
              team1Id: t1.id,
              team2Id: t2.id,
              score1: '',
              score2: ''
            });
          });
        }
      }

      if (!roundValid) {
        scheduleFailed = true;
        break;
      }
      generatedRounds.push(matches);
    }

    if (scheduleFailed) {
      setErrorMsg('Could not generate a non-repeating schedule for this configuration. Try re-randomizing or adjusting match count.');
      return;
    }

    setTeams(createdTeams);
    setRounds(generatedRounds);
    setActiveRoundTab(1);
    setTop4Teams([]);
    setErrorMsg('');
    setStage('qualifying');
  };

  const rerandomizeTeamsAndSchedule = () => {
    startTournament();
  };

  const teamMap = useMemo(() => {
    const map = {};
    teams.forEach(t => { map[t.id] = t; });
    return map;
  }, [teams]);

  const ladderStandings = useMemo(() => {
    if (teams.length === 0) return [];
    const stats = {};
    teams.forEach(t => {
      stats[t.id] = {
        ...t,
        played: 0,
        wins: 0,
        losses: 0,
        pf: 0,
        pa: 0,
        diff: 0
      };
    });

    rounds.forEach(roundMatches => {
      roundMatches.forEach(m => {
        if (m.score1 !== '' && m.score2 !== '') {
          const s1 = parseInt(m.score1, 10);
          const s2 = parseInt(m.score2, 10);
          if (!isNaN(s1) && !isNaN(s2) && s1 !== s2) {
            const st1 = stats[m.team1Id];
            const st2 = stats[m.team2Id];
            if (st1 && st2) {
              st1.played += 1;
              st2.played += 1;
              st1.pf += s1;
              st1.pa += s2;
              st2.pf += s2;
              st2.pa += s1;
              if (s1 > s2) {
                st1.wins += 1;
                st2.losses += 1;
              } else {
                st2.wins += 1;
                st1.losses += 1;
              }
            }
          }
        }
      });
    });

    return Object.values(stats)
      .map(s => ({ ...s, diff: s.pf - s.pa }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.diff !== a.diff) return b.diff - a.diff;
        return b.pf - a.pf;
      });
  }, [teams, rounds]);

  const totalQualifyingMatchesCount = useMemo(() => {
    let count = 0;
    rounds.forEach(r => count += r.length);
    return count;
  }, [rounds]);

  const completedQualifyingMatches = useMemo(() => {
    let count = 0;
    rounds.forEach(r => r.forEach(m => {
      const s1 = parseInt(m.score1, 10);
      const s2 = parseInt(m.score2, 10);
      if (m.score1 !== '' && m.score2 !== '' && !isNaN(s1) && !isNaN(s2) && s1 !== s2) {
        count++;
      }
    }));
    return count;
  }, [rounds]);

  const handleQualifyingScoreChange = (roundIdx, matchIdx, field, val) => {
    if (val !== '' && !/^\d+$/.test(val)) return;
    setRounds(prev => {
      const copy = prev.map(r => r.map(m => ({ ...m })));
      copy[roundIdx][matchIdx][field] = val;
      return copy;
    });
    setErrorMsg('');
  };

  const simulateSingleRound = (roundIdx) => {
    setRounds(prev => {
      const copy = prev.map(r => r.map(m => ({ ...m })));
      copy[roundIdx] = copy[roundIdx].map(m => {
        const [s1, s2] = generateRandomScores(10, 21);
        return { ...m, score1: s1, score2: s2 };
      });
      return copy;
    });
    setErrorMsg('');
  };

  const simulateAllQualifying = () => {
    setRounds(prev =>
      prev.map(roundMatches =>
        roundMatches.map(m => {
          if (m.score1 !== '' && m.score2 !== '' && m.score1 !== m.score2) {
            return m;
          }
          const [s1, s2] = generateRandomScores(10, 21);
          return { ...m, score1: s1, score2: s2 };
        })
      )
    );
    setErrorMsg('');
  };

  const advanceToSemifinals = () => {
    if (completedQualifyingMatches < totalQualifyingMatchesCount) {
      setErrorMsg(`Please complete all ${totalQualifyingMatchesCount} qualifying matches first (${completedQualifyingMatches}/${totalQualifyingMatchesCount} completed, ties not allowed).`);
      return;
    }

    const top4 = ladderStandings.slice(0, 4);
    setTop4Teams(top4);

    setSemiA({
      team1: {
        p1: top4[0].playerA,
        p2: top4[1].playerA,
        label: `Top 1A (${top4[0].name}) & Top 2A (${top4[1].name})`
      },
      team2: {
        p1: top4[2].playerA,
        p2: top4[3].playerA,
        label: `Top 3A (${top4[2].name}) & Top 4A (${top4[3].name})`
      },
      score1: '',
      score2: ''
    });

    setSemiB({
      team1: {
        p1: top4[0].playerB,
        p2: top4[1].playerB,
        label: `Top 1B (${top4[0].name}) & Top 2B (${top4[1].name})`
      },
      team2: {
        p1: top4[2].playerB,
        p2: top4[3].playerB,
        label: `Top 3B (${top4[2].name}) & Top 4B (${top4[3].name})`
      },
      score1: '',
      score2: ''
    });

    setErrorMsg('');
    setStage('semis');
  };

  const simulateSemis = () => {
    const [sa1, sa2] = generateRandomScores(15, 21);
    const [sb1, sb2] = generateRandomScores(15, 21);
    setSemiA(prev => ({ ...prev, score1: sa1, score2: sa2 }));
    setSemiB(prev => ({ ...prev, score1: sb1, score2: sb2 }));
    setErrorMsg('');
  };

  const buildCrossPairedChampionship = (winnersFromA, winnersFromB) => {
    const shufA = shuffleArray(winnersFromA);
    const shufB = shuffleArray(winnersFromB);

    const pair1 = shuffleArray([shufA[0], shufB[0]]);
    const pair2 = shuffleArray([shufA[1], shufB[1]]);

    setChampMatch({
      team1: { playerA: pair1[0], playerB: pair1[1] },
      team2: { playerA: pair2[0], playerB: pair2[1] },
      score1: '',
      score2: ''
    });
  };

  const advanceToChampionship = () => {
    const sa1 = parseInt(semiA.score1, 10);
    const sa2 = parseInt(semiA.score2, 10);
    const sb1 = parseInt(semiB.score1, 10);
    const sb2 = parseInt(semiB.score2, 10);

    if (
      isNaN(sa1) || isNaN(sa2) || sa1 === sa2 ||
      isNaN(sb1) || isNaN(sb2) || sb1 === sb2
    ) {
      setErrorMsg('Please enter valid, non-tied scores for both Semi-Final A and Semi-Final B.');
      return;
    }

    const winnersA = sa1 > sa2
      ? [semiA.team1.p1, semiA.team1.p2]
      : [semiA.team2.p1, semiA.team2.p2];

    const winnersB = sb1 > sb2
      ? [semiB.team1.p1, semiB.team1.p2]
      : [semiB.team2.p1, semiB.team2.p2];

    setFinalistsA(winnersA);
    setFinalistsB(winnersB);
    buildCrossPairedChampionship(winnersA, winnersB);
    setErrorMsg('');
    setStage('championship');
  };

  const reshuffleChampionship = () => {
    if (finalistsA.length === 2 && finalistsB.length === 2) {
      buildCrossPairedChampionship(finalistsA, finalistsB);
      setErrorMsg('');
    }
  };

  const simulateChampionship = () => {
    const [c1, c2] = generateRandomScores(15, 21);
    setChampMatch(prev => ({ ...prev, score1: c1, score2: c2 }));
    setErrorMsg('');
  };

  const championTeam = useMemo(() => {
    const c1 = parseInt(champMatch.score1, 10);
    const c2 = parseInt(champMatch.score2, 10);
    if (isNaN(c1) || isNaN(c2) || c1 === c2) return null;
    return c1 > c2
      ? { name: 'Championship Team 1', ...champMatch.team1, score: `${c1} - ${c2}` }
      : { name: 'Championship Team 2', ...champMatch.team2, score: `${c2} - ${c1}` };
  }, [champMatch]);

  const resetTournament = () => {
    setStage('setup');
    setTeams([]);
    setRounds([]);
    setTop4Teams([]);
    setFinalistsA([]);
    setFinalistsB([]);
    setErrorMsg('');
  };

  // --- UI BADGE COMPONENTS (Blue Theme) ---
  const BadgeA = () => (
    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold tracking-wider uppercase rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-2xs shrink-0">
      A
    </span>
  );

  const BadgeB = () => (
    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold tracking-wider uppercase rounded-md bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200 dark:border-sky-800 shadow-2xs shrink-0">
      B
    </span>
  );

  const numTeams = totalPlayers / 2;
  const maxMatchesPerTeam = Math.max(1, numTeams - 1);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased transition-colors selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight leading-tight truncate bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 dark:from-white dark:to-blue-200 bg-clip-text text-transparent">
                Dynamic Pairings
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {stage !== 'setup' && (
              <button
                onClick={resetTournament}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs transition active:scale-98 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-slate-500" />
                <span>Reset Tournament</span>
              </button>
            )}
          </div>
        </div>

        {/* Stage Stepper Navigation */}
        <div className="bg-slate-100/60 dark:bg-slate-900/40 border-t border-slate-200/60 dark:border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-2.5 overflow-x-auto scrollbar-none">
            {[
              { id: 'setup', label: '0. Roster & Config Setup', icon: UserPlus, enabled: true },
              { id: 'qualifying', label: '1. Qualifying Ladder', icon: ListOrdered, enabled: teams.length > 0 },
              { id: 'semis', label: '2. Split Semifinals', icon: Swords, enabled: top4Teams.length === 4 },
              { id: 'championship', label: '3. Championship', icon: Trophy, enabled: finalistsA.length === 2 }
            ].map((tab, index) => {
              const Icon = tab.icon;
              const isActive = stage === tab.id;
              return (
                <React.Fragment key={tab.id}>
                  <button
                    disabled={!tab.enabled}
                    onClick={() => {
                      setErrorMsg('');
                      setStage(tab.id);
                    }}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all shadow-2xs ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 ring-2 ring-blue-600/20'
                        : tab.enabled
                        ? 'text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 cursor-pointer'
                        : 'text-slate-400 dark:text-slate-600 bg-transparent border border-transparent cursor-not-allowed opacity-60'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                  {index < 3 && (
                    <ChevronRight className="w-4 h-4 text-slate-400/60 shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Global Error Banner */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-3 text-rose-700 dark:text-rose-300 text-sm shadow-sm animate-shake">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <span className="font-medium break-words">{errorMsg}</span>
          </div>
        )}

        {/* ===================================================================== */}
        {/* STAGE 0: ROSTER & CONFIG SETUP                                        */}
        {/* ===================================================================== */}
        {stage === 'setup' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-6 sm:p-8 shadow-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                {/* Player Count Selector */}
                <div>
                  <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Total Number of Players (Must be Even, 4 - 32)
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handlePlayerCountChange(Math.max(4, totalPlayers - 2))}
                      disabled={totalPlayers <= 4}
                      className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shrink-0"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0 text-center py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 font-mono font-bold text-base sm:text-lg truncate">
                      {totalPlayers} Players <span className="text-xs font-normal text-slate-500">({numTeams} Teams)</span>
                    </div>
                    <button
                      onClick={() => handlePlayerCountChange(Math.min(32, totalPlayers + 2))}
                      disabled={totalPlayers >= 32}
                      className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shrink-0"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                    Players are randomly paired into {numTeams} teams of 2.
                  </p>
                </div>

                {/* Matches Per Team Selector */}
                <div>
                  <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Matches Per Team in Qualifying Round (1 - {maxMatchesPerTeam})
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setMatchesPerTeam(Math.max(1, matchesPerTeam - 1))}
                      disabled={matchesPerTeam <= 1}
                      className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shrink-0"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0 text-center py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 font-mono font-bold text-base sm:text-lg truncate">
                      {matchesPerTeam} Rounds <span className="text-xs font-normal text-slate-500">({matchesPerTeam * (numTeams / 2)} Total)</span>
                    </div>
                    <button
                      onClick={() => setMatchesPerTeam(Math.min(maxMatchesPerTeam, matchesPerTeam + 1))}
                      disabled={matchesPerTeam >= maxMatchesPerTeam}
                      className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shrink-0"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                    Determines how many round-robin rounds are scheduled.
                  </p>
                </div>
              </div>

              {/* Roster Header Action Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pt-6">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold flex items-center gap-2 truncate">
                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="truncate">Enter Player Names ({totalPlayers})</span>
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={handleAutoFill}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition active:scale-98 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Auto-Fill Names</span>
                  </button>
                  <button
                    onClick={handleClearInputs}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition active:scale-98 cursor-pointer"
                  >
                    <span>Clear</span>
                  </button>
                  <button
                    onClick={startTournament}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25 transition active:scale-98 cursor-pointer"
                  >
                    <Shuffle className="w-4 h-4 shrink-0" />
                    <span>Randomize Teams & Start</span>
                  </button>
                </div>
              </div>

              {/* Player Input Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 mt-6">
                {playerInputs.map((name, idx) => (
                  <div key={idx} className="relative group min-w-0">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-slate-400 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors pointer-events-none">
                      #{String(idx + 1).padStart(2, '0')}
                    </span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handlePlayerChange(idx, e.target.value)}
                      placeholder={`Player ${String(idx + 1).padStart(2, '0')}`}
                      className="w-full pl-12 pr-3.5 py-3 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all shadow-2xs truncate"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* STAGE 1: QUALIFYING ROUND                                             */}
        {/* ===================================================================== */}
        {stage === 'qualifying' && (
          <div className="space-y-6">
            {/* Top Action Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-xl font-bold tracking-tight truncate">Stage 1: Qualifying Ladder</h2>
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 shrink-0">
                    {completedQualifyingMatches} / {rounds.reduce((acc, r) => acc + r.length, 0)} Completed
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Each team plays {matchesPerTeam} rounds. Top 4 teams on the ladder advance to Semifinals.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={rerandomizeTeamsAndSchedule}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition active:scale-98 cursor-pointer shadow-2xs"
                >
                  <Shuffle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Re-Randomize</span>
                </button>
                <button
                  onClick={simulateAllQualifying}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition active:scale-98 cursor-pointer shadow-2xs"
                >
                  <Play className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Simulate All</span>
                </button>
                <button
                  onClick={advanceToSemifinals}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition active:scale-98 cursor-pointer ${
                    completedQualifyingMatches === rounds.reduce((acc, r) => acc + r.length, 0)
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span>Proceed to Semis</span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </div>

            {/* Assigned Teams Overview */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                  Assigned {numTeams} Teams (Role A & Role B)
                </h3>
                <button
                  onClick={() => setStage('setup')}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer shrink-0"
                >
                  Edit Roster Names
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {teams.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 hover:border-blue-300 dark:hover:border-blue-700 transition-colors min-w-0"
                  >
                    <div className="text-xs font-extrabold text-blue-600 dark:text-blue-400 mb-1.5 truncate">
                      {t.name}
                    </div>
                    <div className="flex items-center gap-1.5 py-0.5 min-w-0 text-xs">
                      <BadgeA /> <span className="truncate font-medium">{t.playerA}</span>
                    </div>
                    <div className="flex items-center gap-1.5 py-0.5 mt-0.5 min-w-0 text-xs">
                      <BadgeB /> <span className="truncate font-medium">{t.playerB}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Main Split Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left Column: Match Schedule */}
              <div className="xl:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden min-w-0">
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/40">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    {rounds.map((roundMatches, idx) => {
                      const rNum = idx + 1;
                      const doneCount = roundMatches.filter(
                        m => m.score1 !== '' && m.score2 !== '' && m.score1 !== m.score2
                      ).length;
                      const isComplete = doneCount === roundMatches.length;
                      return (
                        <button
                          key={rNum}
                          onClick={() => setActiveRoundTab(rNum)}
                          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                            activeRoundTab === rNum
                              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80'
                          }`}
                        >
                          <span>Round {rNum}</span>
                          {isComplete && (
                            <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${activeRoundTab === rNum ? 'text-blue-200' : 'text-emerald-500'}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => simulateSingleRound(activeRoundTab - 1)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition cursor-pointer shrink-0"
                  >
                    <Play className="w-3.5 h-3.5 shrink-0" />
                    <span>Simulate R{activeRoundTab}</span>
                  </button>
                </div>

                {/* Matches List for Active Round */}
                <div className="p-4 sm:p-5 space-y-3.5">
                  {(rounds[activeRoundTab - 1] || []).map((match, mIdx) => {
                    const t1 = teamMap[match.team1Id];
                    const t2 = teamMap[match.team2Id];
                    if (!t1 || !t2) return null;

                    const s1 = parseInt(match.score1, 10);
                    const s2 = parseInt(match.score2, 10);
                    const hasWinner = !isNaN(s1) && !isNaN(s2) && s1 !== s2;
                    const t1Won = hasWinner && s1 > s2;
                    const t2Won = hasWinner && s2 > s1;

                    return (
                      <div
                        key={match.id}
                        className="p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between gap-3.5 transition-all min-w-0"
                      >
                        {/* Team 1 */}
                        <div className={`flex-1 w-full sm:w-auto text-left sm:text-right min-w-0 ${t1Won ? 'font-bold text-blue-600 dark:text-blue-400' : ''}`}>
                          <div className="text-sm font-bold flex items-center sm:justify-end gap-2 min-w-0">
                            <span className="truncate">{t1.name}</span>
                            {t1Won && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded font-bold shrink-0">Win</span>}
                          </div>
                          <div className="mt-1.5 space-y-1">
                            <div className="flex items-center sm:justify-end gap-1.5 text-xs font-medium min-w-0">
                              <span className="truncate">{t1.playerA}</span>
                              <BadgeA />
                            </div>
                            <div className="flex items-center sm:justify-end gap-1.5 text-xs font-medium min-w-0">
                              <span className="truncate">{t1.playerB}</span>
                              <BadgeB />
                            </div>
                          </div>
                        </div>

                        {/* Score Inputs */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={3}
                            value={match.score1}
                            onChange={(e) => handleQualifyingScoreChange(activeRoundTab - 1, mIdx, 'score1', e.target.value)}
                            placeholder="0"
                            aria-label={`${t1.name} score`}
                            className={`w-14 h-12 text-center font-bold text-base rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                              t1Won
                                ? 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs'
                            }`}
                          />
                          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest shrink-0">vs</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={3}
                            value={match.score2}
                            onChange={(e) => handleQualifyingScoreChange(activeRoundTab - 1, mIdx, 'score2', e.target.value)}
                            placeholder="0"
                            aria-label={`${t2.name} score`}
                            className={`w-14 h-12 text-center font-bold text-base rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                              t2Won
                                ? 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs'
                            }`}
                          />
                        </div>

                        {/* Team 2 */}
                        <div className={`flex-1 w-full sm:w-auto text-left min-w-0 ${t2Won ? 'font-bold text-blue-600 dark:text-blue-400' : ''}`}>
                          <div className="text-sm font-bold flex items-center gap-2 min-w-0">
                            <span className="truncate">{t2.name}</span>
                            {t2Won && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded font-bold shrink-0">Win</span>}
                          </div>
                          <div className="mt-1.5 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-medium min-w-0">
                              <BadgeA />
                              <span className="truncate">{t2.playerA}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-medium min-w-0">
                              <BadgeB />
                              <span className="truncate">{t2.playerB}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Live Ladder Standings */}
              <div className="xl:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden min-w-0">
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ListOrdered className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <h3 className="font-bold text-sm sm:text-base truncate">Live Ladder Standings</h3>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
                    Top 4 Qualify
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[340px]">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/40 dark:bg-slate-900/20">
                        <th className="py-3 pl-4 pr-2">Rank</th>
                        <th className="py-3 px-2">Team & Players</th>
                        <th className="py-3 px-2 text-center">MP</th>
                        <th className="py-3 px-2 text-center">W</th>
                        <th className="py-3 px-2 text-center">Diff</th>
                        <th className="py-3 pl-2 pr-4 text-center">PF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                      {ladderStandings.map((team, idx) => {
                        const isTop4 = idx < 4;
                        return (
                          <tr
                            key={team.id}
                            className={`transition-colors ${
                              isTop4
                                ? 'bg-blue-50/60 dark:bg-blue-950/30'
                                : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="py-3 pl-4 pr-2 font-mono font-bold">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                                  isTop4
                                    ? 'bg-blue-600 text-white shadow-2xs'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-3 px-2 min-w-0 max-w-[160px] sm:max-w-[200px]">
                              <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 min-w-0">
                                <span className="truncate">{team.name}</span>
                                {isTop4 && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/80 text-blue-700 dark:text-blue-300 shrink-0">
                                    Q
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-1 mt-1.5 min-w-0">
                                <div className="flex items-center gap-1.5 font-medium min-w-0">
                                  <BadgeA /> <span className="truncate">{team.playerA}</span>
                                </div>
                                <div className="flex items-center gap-1.5 font-medium min-w-0">
                                  <BadgeB /> <span className="truncate">{team.playerB}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-center font-mono text-xs text-slate-500 font-medium whitespace-nowrap">
                              {team.played}/{matchesPerTeam}
                            </td>
                            <td className="py-3 px-2 text-center font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {team.wins}
                            </td>
                            <td className={`py-3 px-2 text-center font-mono text-xs font-semibold whitespace-nowrap ${
                              team.diff > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : team.diff < 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-500'
                            }`}>
                              {team.diff > 0 ? `+${team.diff}` : team.diff}
                            </td>
                            <td className="py-3 pl-2 pr-4 text-center font-mono text-xs text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                              {team.pf}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* STAGE 2: SEMIFINALS                                                   */}
        {/* ===================================================================== */}
        {stage === 'semis' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight truncate">Stage 2: Split A & B Semifinals</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Top 4 qualifying teams split into separate <BadgeA /> and <BadgeB /> brackets: (1 & 2) vs (3 & 4).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={simulateSemis}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition active:scale-98 cursor-pointer shadow-2xs"
                >
                  <Play className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Simulate Both Semis</span>
                </button>
                <button
                  onClick={advanceToChampionship}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25 transition active:scale-98 cursor-pointer"
                >
                  <span>Proceed to Championship</span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </div>

            {/* Top 4 Qualifiers Summary Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {top4Teams.map((t, idx) => (
                <div
                  key={t.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-4 flex items-center gap-3.5 shadow-xs min-w-0"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
                    #{idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate">{t.name} <span className="text-xs text-slate-400 font-normal">({t.wins}W)</span></div>
                    <div className="space-y-1 mt-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 min-w-0">
                        <BadgeA /> <span className="truncate">{t.playerA}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 min-w-0">
                        <BadgeB /> <span className="truncate">{t.playerB}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Two Semifinal Match Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* SEMI-FINAL A */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-blue-200/80 dark:border-blue-900/60 p-6 sm:p-7 shadow-xs space-y-5 min-w-0">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <BadgeA />
                    <h3 className="text-lg font-bold truncate">Semi-Final A Bracket</h3>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 shrink-0">
                    Winners Advance
                  </span>
                </div>

                {/* Team 1 */}
                <div className={`p-4.5 rounded-2xl border transition-all min-w-0 ${
                  parseInt(semiA.score1, 10) > parseInt(semiA.score2, 10)
                    ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-2xs'
                    : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                }`}>
                  <div className="flex items-center justify-between gap-4 min-w-0">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 truncate block">
                        {semiA.team1.label}
                      </span>
                      <div className="mt-2.5 space-y-2 min-w-0">
                        <div className="font-bold text-sm sm:text-base flex items-center gap-2 min-w-0">
                          <BadgeA /> <span className="truncate">{semiA.team1.p1}</span>
                        </div>
                        <div className="font-bold text-sm sm:text-base flex items-center gap-2 min-w-0">
                          <BadgeA /> <span className="truncate">{semiA.team1.p2}</span>
                        </div>
                      </div>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={3}
                      value={semiA.score1}
                      onChange={(e) => {
                        if (e.target.value === '' || /^\d+$/.test(e.target.value)) {
                          setSemiA(prev => ({ ...prev, score1: e.target.value }));
                          setErrorMsg('');
                        }
                      }}
                      placeholder="0"
                      className="w-16 h-14 text-center text-xl font-bold rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs shrink-0"
                    />
                  </div>
                </div>

                <div className="text-center text-xs font-extrabold uppercase tracking-widest text-slate-400 py-1">
                  — VERSUS —
                </div>

                {/* Team 2 */}
                <div className={`p-4.5 rounded-2xl border transition-all min-w-0 ${
                  parseInt(semiA.score2, 10) > parseInt(semiA.score1, 10)
                    ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-2xs'
                    : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                }`}>
                  <div className="flex items-center justify-between gap-4 min-w-0">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 truncate block">
                        {semiA.team2.label}
                      </span>
                      <div className="mt-2.5 space-y-2 min-w-0">
                        <div className="font-bold text-sm sm:text-base flex items-center gap-2 min-w-0">
                          <BadgeA /> <span className="truncate">{semiA.team2.p1}</span>
                        </div>
                        <div className="font-bold text-sm sm:text-base flex items-center gap-2 min-w-0">
                          <BadgeA /> <span className="truncate">{semiA.team2.p2}</span>
                        </div>
                      </div>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={3}
                      value={semiA.score2}
                      onChange={(e) => {
                        if (e.target.value === '' || /^\d+$/.test(e.target.value)) {
                          setSemiA(prev => ({ ...prev, score2: e.target.value }));
                          setErrorMsg('');
                        }
                      }}
                      placeholder="0"
                      className="w-16 h-14 text-center text-xl font-bold rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs shrink-0"
                    />
                  </div>
                </div>
              </div>

              {/* SEMI-FINAL B */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-sky-200/80 dark:border-sky-900/60 p-6 sm:p-7 shadow-xs space-y-5 min-w-0">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <BadgeB />
                    <h3 className="text-lg font-bold truncate">Semi-Final B Bracket</h3>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-400 shrink-0">
                    Winners Advance
                  </span>
                </div>

                {/* Team 1 */}
                <div className={`p-4.5 rounded-2xl border transition-all min-w-0 ${
                  parseInt(semiB.score1, 10) > parseInt(semiB.score2, 10)
                    ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-2xs'
                    : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                }`}>
                  <div className="flex items-center justify-between gap-4 min-w-0">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 truncate block">
                        {semiB.team1.label}
                      </span>
                      <div className="mt-2.5 space-y-2 min-w-0">
                        <div className="font-bold text-sm sm:text-base flex items-center gap-2 min-w-0">
                          <BadgeB /> <span className="truncate">{semiB.team1.p1}</span>
                        </div>
                        <div className="font-bold text-sm sm:text-base flex items-center gap-2 min-w-0">
                          <BadgeB /> <span className="truncate">{semiB.team1.p2}</span>
                        </div>
                      </div>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={3}
                      value={semiB.score1}
                      onChange={(e) => {
                        if (e.target.value === '' || /^\d+$/.test(e.target.value)) {
                          setSemiB(prev => ({ ...prev, score1: e.target.value }));
                          setErrorMsg('');
                        }
                      }}
                      placeholder="0"
                      className="w-16 h-14 text-center text-xl font-bold rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs shrink-0"
                    />
                  </div>
                </div>

                <div className="text-center text-xs font-extrabold uppercase tracking-widest text-slate-400 py-1">
                  — VERSUS —
                </div>

                {/* Team 2 */}
                <div className={`p-4.5 rounded-2xl border transition-all min-w-0 ${
                  parseInt(semiB.score2, 10) > parseInt(semiB.score1, 10)
                    ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-2xs'
                    : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                }`}>
                  <div className="flex items-center justify-between gap-4 min-w-0">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 truncate block">
                        {semiB.team2.label}
                      </span>
                      <div className="mt-2.5 space-y-2 min-w-0">
                        <div className="font-bold text-sm sm:text-base flex items-center gap-2 min-w-0">
                          <BadgeB /> <span className="truncate">{semiB.team2.p1}</span>
                        </div>
                        <div className="font-bold text-sm sm:text-base flex items-center gap-2 min-w-0">
                          <BadgeB /> <span className="truncate">{semiB.team2.p2}</span>
                        </div>
                      </div>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={3}
                      value={semiB.score2}
                      onChange={(e) => {
                        if (e.target.value === '' || /^\d+$/.test(e.target.value)) {
                          setSemiB(prev => ({ ...prev, score2: e.target.value }));
                          setErrorMsg('');
                        }
                      }}
                      placeholder="0"
                      className="w-16 h-14 text-center text-xl font-bold rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs shrink-0"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* STAGE 3: CHAMPIONSHIP                                                 */}
        {/* ===================================================================== */}
        {stage === 'championship' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2.5 min-w-0">
                  <Trophy className="w-6 h-6 text-blue-500 shrink-0" />
                  <span className="truncate">Stage 3: Championship Final</span>
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Semis teammates are separated onto opposing teams, with <BadgeA /> and <BadgeB /> roles randomly assigned.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={reshuffleChampionship}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition active:scale-98 cursor-pointer shadow-2xs"
                >
                  <Shuffle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Re-Shuffle Roles</span>
                </button>
                <button
                  onClick={simulateChampionship}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25 transition active:scale-98 cursor-pointer"
                >
                  <Play className="w-4 h-4 shrink-0" />
                  <span>Simulate Final</span>
                </button>
              </div>
            </div>

            {/* Celebratory Champions Banner */}
            {championTeam && (
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-blue-600 to-sky-600 p-6 sm:p-8 text-white shadow-xl">
                <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 min-w-0">
                  <div className="flex items-center gap-4.5 text-center md:text-left flex-col md:flex-row min-w-0">
                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-lg">
                      <Award className="w-9 h-9 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold uppercase tracking-wider mb-2 shadow-2xs">
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                        <span>Tournament Champions</span>
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate">
                        {championTeam.playerA} & {championTeam.playerB}
                      </h3>
                      <p className="text-white/90 text-sm mt-1 font-medium truncate">
                        {championTeam.name} • Final Score: <span className="font-bold underline decoration-white/40">{championTeam.score}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 bg-black/20 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/20 shadow-lg shrink-0">
                    <div className="text-center px-1">
                      <div className="text-[10px] uppercase tracking-wider text-white/75 font-semibold">Role A</div>
                      <div className="font-bold text-sm sm:text-base mt-0.5 truncate max-w-[120px]">{championTeam.playerA}</div>
                    </div>
                    <div className="h-8 w-px bg-white/25" />
                    <div className="text-center px-1">
                      <div className="text-[10px] uppercase tracking-wider text-white/75 font-semibold">Role B</div>
                      <div className="font-bold text-sm sm:text-base mt-0.5 truncate max-w-[120px]">{championTeam.playerB}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Championship Matchup Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-6 sm:p-8 shadow-xs">
              <div className="grid grid-cols-1 md:grid-cols-11 gap-6 items-center min-w-0">
                {/* Championship Team 1 */}
                <div className={`md:col-span-5 p-6 rounded-2xl border-2 transition-all min-w-0 ${
                  parseInt(champMatch.score1, 10) > parseInt(champMatch.score2, 10)
                    ? 'border-blue-400 bg-blue-50/40 dark:bg-blue-950/20 shadow-sm'
                    : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                }`}>
                  <div className="flex items-center justify-between mb-5 gap-2 min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 truncate">
                      Championship Team 1
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={3}
                      value={champMatch.score1}
                      onChange={(e) => {
                        if (e.target.value === '' || /^\d+$/.test(e.target.value)) {
                          setChampMatch(prev => ({ ...prev, score1: e.target.value }));
                          setErrorMsg('');
                        }
                      }}
                      placeholder="0"
                      className="w-16 h-14 text-center text-xl font-bold rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs shrink-0"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 shadow-2xs min-w-0">
                      <span className="font-bold text-sm sm:text-base truncate">{champMatch.team1.playerA}</span>
                      <BadgeA />
                    </div>
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 shadow-2xs min-w-0">
                      <span className="font-bold text-sm sm:text-base truncate">{champMatch.team1.playerB}</span>
                      <BadgeB />
                    </div>
                  </div>
                </div>

                {/* VS Divider */}
                <div className="md:col-span-1 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-extrabold text-xs text-slate-500 shadow-2xs">
                    VS
                  </div>
                </div>

                {/* Championship Team 2 */}
                <div className={`md:col-span-5 p-6 rounded-2xl border-2 transition-all min-w-0 ${
                  parseInt(champMatch.score2, 10) > parseInt(champMatch.score1, 10)
                    ? 'border-blue-400 bg-blue-50/40 dark:bg-blue-950/20 shadow-sm'
                    : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                }`}>
                  <div className="flex items-center justify-between mb-5 gap-2 min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 truncate">
                      Championship Team 2
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={3}
                      value={champMatch.score2}
                      onChange={(e) => {
                        if (e.target.value === '' || /^\d+$/.test(e.target.value)) {
                          setChampMatch(prev => ({ ...prev, score2: e.target.value }));
                          setErrorMsg('');
                        }
                      }}
                      placeholder="0"
                      className="w-16 h-14 text-center text-xl font-bold rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs shrink-0"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 shadow-2xs min-w-0">
                      <span className="font-bold text-sm sm:text-base truncate">{champMatch.team2.playerA}</span>
                      <BadgeA />
                    </div>
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 shadow-2xs min-w-0">
                      <span className="font-bold text-sm sm:text-base truncate">{champMatch.team2.playerB}</span>
                      <BadgeB />
                    </div>
                  </div>
                </div>
              </div>

              {/* Verification Footer */}
              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="truncate">
                    Rule Verified: Semi-Final winners successfully cross-paired and separated onto opposite teams.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}