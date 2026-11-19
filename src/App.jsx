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
  // Navigation & Stage State: 'setup' | 'qualifying' | 'playoffs' | 'championship'
  const [stage, setStage] = useState('setup');
  const [errorMsg, setErrorMsg] = useState('');

  // Setup configuration state:
  const [totalPlayers, setTotalPlayers] = useState(24);
  const [matchesPerTeam, setMatchesPerTeam] = useState(5);
  const [playoffTeamCount, setPlayoffTeamCount] = useState(4); // Requirement 1: Configurable even number of playoff teams

  // Player Inputs array
  const [playerInputs, setPlayerInputs] = useState(Array(24).fill(''));

  // Stage 1: Teams & Qualifying Schedule
  const [teams, setTeams] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [activeRoundTab, setActiveRoundTab] = useState(1);

  // Stage 2: Playoffs State
  const [playoffRoundsCount, setPlayoffRoundsCount] = useState(1); // Requirement 3: How many rounds/games for playoff teams
  const [qualifiedPlayoffTeams, setQualifiedPlayoffTeams] = useState([]);
  // playoffRounds: array of round objects containing matches
  const [playoffRounds, setPlayoffRounds] = useState([]);
  const [activePlayoffRoundTab, setActivePlayoffRoundTab] = useState(1);

  // Stage 3: Championship State
  const [championshipGamesCount, setChampionshipGamesCount] = useState(1); // Requirement 6: Select how many games in championship
  const [championshipFinalists, setChampionshipFinalists] = useState([]); // Requirement 4: Top 2 players/teams
  const [championshipMatches, setChampionshipMatches] = useState([]);

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
    // Ensure playoff team count doesn't exceed total teams and is even
    if (playoffTeamCount > newNumTeams) {
      const adjusted = newNumTeams % 2 === 0 ? newNumTeams : Math.max(2, newNumTeams - 1);
      setPlayoffTeamCount(adjusted);
    }
    setErrorMsg('');
  };

  const handlePlayoffTeamCountChange = (newCount) => {
    const maxTeams = totalPlayers / 2;
    if (newCount < 2 || newCount > maxTeams || newCount % 2 !== 0) return;
    setPlayoffTeamCount(newCount);
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

    if (playoffTeamCount > numTeams || playoffTeamCount % 2 !== 0) {
      setErrorMsg(`Playoff team count must be an even number between 2 and ${numTeams}.`);
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
    const oppositionHistory = {};
    createdTeams.forEach(t => { oppositionHistory[t.id] = new Set(); });

    let scheduleFailed = false;

    for (let r = 1; r <= matchesPerTeam; r++) {
      const matches = [];
      let availableTeams = shuffleArray([...createdTeams]);
      let roundValid = false;
      let attempts = 0;

      while (!roundValid && attempts < 100) {
        attempts++;
        availableTeams = shuffleArray([...createdTeams]);
        const currentRoundPairs = [];
        const matchedInThisRound = new Set();
        let failed = false;

        while (availableTeams.length > 0) {
          const t1 = availableTeams.pop();
          if (matchedInThisRound.has(t1.id)) continue;

          const eligibleOpponents = availableTeams.filter(
            t2 => !matchedInThisRound.has(t2.id) && !oppositionHistory[t1.id].has(t2.id)
          );

          if (eligibleOpponents.length === 0) {
            failed = true;
            break;
          }

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
    setQualifiedPlayoffTeams([]);
    setPlayoffRounds([]);
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

  // --- TRANSITION TO PLAYOFFS ---
  const advanceToPlotform = () => {
    if (completedQualifyingMatches < totalQualifyingMatchesCount) {
      setErrorMsg(`Please complete all ${totalQualifyingMatchesCount} qualifying matches first (${completedQualifyingMatches}/${totalQualifyingMatchesCount} completed).`);
      return;
    }

    const topTeams = ladderStandings.slice(0, playoffTeamCount);
    const playoffTeamsConstructed = [];

    // Adjacent Rank Partner Swap (1<->2, 3<->4, ...) with sequential playoff naming starting at Team 1
    for (let i = 0; i < topTeams.length; i += 2) {
      const t1 = topTeams[i];
      const t2 = topTeams[i + 1];

      if (t2) {
        const team1Num = playoffTeamsConstructed.length + 1;
        const team2Num = team1Num + 1;

        playoffTeamsConstructed.push(
          {
            id: `PT${team1Num}`,
            name: `Team ${team1Num}`,
            playerA: t1.playerA,
            playerB: t2.playerB
          },
          {
            id: `PT${team2Num}`,
            name: `Team ${team2Num}`,
            playerA: t2.playerA,
            playerB: t1.playerB
          }
        );
      } else {
        const teamNum = playoffTeamsConstructed.length + 1;
        playoffTeamsConstructed.push({
          id: `PT${teamNum}`,
          name: `Team ${teamNum}`,
          playerA: t1.playerA,
          playerB: t1.playerB
        });
      }
    }

    setQualifiedPlayoffTeams(playoffTeamsConstructed);

    // Build Playoff Schedule based on playoffRoundsCount rounds (Round-Robin or Bracket style rounds)
    // Let's create single round-robin rounds among the playoff teams for the specified number of playoff rounds
    const generatedPlayoffRounds = [];
    const pOppositionHistory = {};
    playoffTeamsConstructed.forEach(t => { pOppositionHistory[t.id] = new Set(); });

    let pScheduleFailed = false;
    const maxPRounds = playoffTeamCount - 1;
    const actualPRoundsToBuild = Math.min(playoffRoundsCount, maxPRounds);

    for (let r = 1; r <= actualPRoundsToBuild; r++) {
      const matches = [];
      let available = shuffleArray([...playoffTeamsConstructed]);
      let roundValid = false;
      let attempts = 0;

      while (!roundValid && attempts < 100) {
        attempts++;
        available = shuffleArray([...playoffTeamsConstructed]);
        const currentPairs = [];
        const matchedThisRound = new Set();
        let failed = false;

        while (available.length > 0) {
          const t1 = available.pop();
          if (matchedThisRound.has(t1.id)) continue;

          const eligible = available.filter(
            t2 => !matchedThisRound.has(t2.id) && !pOppositionHistory[t1.id].has(t2.id)
          );

          if (eligible.length === 0) {
            failed = true;
            break;
          }

          const t2 = eligible[Math.floor(Math.random() * eligible.length)];
          matchedThisRound.add(t1.id);
          matchedThisRound.add(t2.id);
          currentPairs.push({ t1, t2 });
        }

        if (!failed && currentPairs.length === playoffTeamCount / 2) {
          roundValid = true;
          currentPairs.forEach((pair, idx) => {
            const { t1, t2 } = pair;
            pOppositionHistory[t1.id].add(t2.id);
            pOppositionHistory[t2.id].add(t1.id);

            matches.push({
              id: `PR${r}-M${idx + 1}`,
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
        pScheduleFailed = true;
        break;
      }
      generatedPlayoffRounds.push(matches);
    }

    if (pScheduleFailed && generatedPlayoffRounds.length === 0) {
      // Fallback simple pairing for 1st playoff round if constraints tight
      const matches = [];
      for (let i = 0; i < playoffTeamsConstructed.length; i += 2) {
        matches.push({
          id: `PR1-M${i / 2 + 1}`,
          round: 1,
          team1Id: playoffTeamsConstructed[i].id,
          team2Id: playoffTeamsConstructed[i + 1].id,
          score1: '',
          score2: ''
        });
      }
      generatedPlayoffRounds.push(matches);
    }

    setPlayoffRounds(generatedPlayoffRounds);
    setActivePlayoffRoundTab(1);
    setErrorMsg('');
    setStage('playoffs');
  };

  const playoffTeamMap = useMemo(() => {
    const map = {};
    qualifiedPlayoffTeams.forEach(t => { map[t.id] = t; });
    return map;
  }, [qualifiedPlayoffTeams]);

  const playoffStandings = useMemo(() => {
    if (qualifiedPlayoffTeams.length === 0) return [];
    const stats = {};
    qualifiedPlayoffTeams.forEach(t => {
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

    playoffRounds.forEach(roundMatches => {
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
  }, [qualifiedPlayoffTeams, playoffRounds]);

  const totalPlayoffMatchesCount = useMemo(() => {
    let count = 0;
    playoffRounds.forEach(r => count += r.length);
    return count;
  }, [playoffRounds]);

  const completedPlayoffMatches = useMemo(() => {
    let count = 0;
    playoffRounds.forEach(r => r.forEach(m => {
      const s1 = parseInt(m.score1, 10);
      const s2 = parseInt(m.score2, 10);
      if (m.score1 !== '' && m.score2 !== '' && !isNaN(s1) && !isNaN(s2) && s1 !== s2) {
        count++;
      }
    }));
    return count;
  }, [playoffRounds]);

  const handlePlayoffScoreChange = (roundIdx, matchIdx, field, val) => {
    if (val !== '' && !/^\d+$/.test(val)) return;
    setPlayoffRounds(prev => {
      const copy = prev.map(r => r.map(m => ({ ...m })));
      copy[roundIdx][matchIdx][field] = val;
      return copy;
    });
    setErrorMsg('');
  };

  const simulateSinglePlayoffRound = (roundIdx) => {
    setPlayoffRounds(prev => {
      const copy = prev.map(r => r.map(m => ({ ...m })));
      copy[roundIdx] = copy[roundIdx].map(m => {
        const [s1, s2] = generateRandomScores(10, 21);
        return { ...m, score1: s1, score2: s2 };
      });
      return copy;
    });
    setErrorMsg('');
  };

  const simulateAllPlayoffs = () => {
    setPlayoffRounds(prev =>
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

  // --- TRANSITION TO CHAMPIONSHIP (Requirements 4 & 5 & 6) ---
  const advanceToChampionship = () => {
    if (completedPlayoffMatches < totalPlayoffMatchesCount) {
      setErrorMsg(`Please complete all playoff matches first (${completedPlayoffMatches}/${totalPlayoffMatchesCount} completed).`);
      return;
    }

    // Requirement 4: Rank the playoff teams and have the top 2 players/teams proceed to the championship.
    // If teams are ranked, the top 2 teams or top 2 players overall from the playoff standings proceed.
    const topPlayoffTeams = playoffStandings.slice(0, 2);
    setChampionshipFinalists(topPlayoffTeams);

    // Requirement 5: Swap players of the 2 championship teams.
    // Team 1 has (p1A, p1B) and Team 2 has (p2A, p2B). Swap players between them to form new championship matchup!
    const t1 = topPlayoffTeams[0];
    const t2 = topPlayoffTeams[1];

    const swappedTeam1Players = [t1.playerA, t2.playerA];
    const swappedTeam2Players = [t1.playerB, t2.playerB];

    // Requirement 6: Select how many games in the championship
    const gamesCount = Math.max(1, championshipGamesCount);
    const matches = [];
    for (let g = 1; g <= gamesCount; g++) {
      matches.push({
        id: `Champ-G${g}`,
        gameNumber: g,
        team1: { playerA: swappedTeam1Players[0], playerB: swappedTeam1Players[1], name: 'Finalist Team 1' },
        team2: { playerA: swappedTeam2Players[0], playerB: swappedTeam2Players[1], name: 'Finalist Team 2' },
        score1: '',
        score2: ''
      });
    }

    setChampionshipMatches(matches);
    setErrorMsg('');
    setStage('championship');
  };

  const handleChampionshipScoreChange = (matchIdx, field, val) => {
    if (val !== '' && !/^\d+$/.test(val)) return;
    setChampionshipMatches(prev => {
      const copy = prev.map(m => ({ ...m }));
      copy[matchIdx][field] = val;
      return copy;
    });
    setErrorMsg('');
  };

  const simulateChampionshipSeries = () => {
    setChampionshipMatches(prev =>
      prev.map(m => {
        const [s1, s2] = generateRandomScores(15, 21);
        return { ...m, score1: s1, score2: s2 };
      })
    );
    setErrorMsg('');
  };

  const championshipWinner = useMemo(() => {
    if (championshipMatches.length === 0) return null;
    let t1Wins = 0;
    let t2Wins = 0;
    let allCompleted = true;

    championshipMatches.forEach(m => {
      const s1 = parseInt(m.score1, 10);
      const s2 = parseInt(m.score2, 10);
      if (isNaN(s1) || isNaN(s2) || s1 === s2) {
        allCompleted = false;
      } else if (s1 > s2) {
        t1Wins++;
      } else {
        t2Wins++;
      }
    });

    if (!allCompleted && t1Wins === 0 && t2Wins === 0) return null;

    if (t1Wins > t2Wins) {
      return {
        name: 'Championship Team 1',
        playerA: championshipMatches[0].team1.playerA,
        playerB: championshipMatches[0].team1.playerB,
        wins: `${t1Wins} - ${t2Wins} Games`
      };
    } else if (t2Wins > t1Wins) {
      return {
        name: 'Championship Team 2',
        playerA: championshipMatches[0].team2.playerA,
        playerB: championshipMatches[0].team2.playerB,
        wins: `${t2Wins} - ${t1Wins} Games`
      };
    }
    return null;
  }, [championshipMatches]);

  const resetTournament = () => {
    setStage('setup');
    setTeams([]);
    setRounds([]);
    setQualifiedPlayoffTeams([]);
    setPlayoffRounds([]);
    setChampionshipFinalists([]);
    setChampionshipMatches([]);
    setErrorMsg('');
  };

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
                Dynamic Playoff Tournament
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
              { id: 'playoffs', label: '2. Playoff Stage', icon: Swords, enabled: qualifiedPlayoffTeams.length > 0 },
              { id: 'championship', label: '3. Championship Series', icon: Trophy, enabled: championshipFinalists.length === 2 }
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
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-3 text-rose-700 dark:text-rose-300 text-sm shadow-sm">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                {/* Player Count Selector */}
                <div>
                  <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Total Players (Even, 4 - 32)
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handlePlayerCountChange(Math.max(4, totalPlayers - 2))}
                      disabled={totalPlayers <= 4}
                      className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shrink-0"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0 text-center py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 font-mono font-bold text-sm sm:text-base truncate">
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
                </div>

                {/* Requirement 1: Playoff Teams Count (Even Number) */}
                <div>
                  <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Playoff Teams (Even, 2 - {numTeams})
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handlePlayoffTeamCountChange(Math.max(2, playoffTeamCount - 2))}
                      disabled={playoffTeamCount <= 2}
                      className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shrink-0"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0 text-center py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 font-mono font-bold text-sm sm:text-base truncate">
                      {playoffTeamCount} Teams <span className="text-xs font-normal text-slate-500">{playoffTeamCount === 6 ? '(Special 6-Team Swap)' : ''}</span>
                    </div>
                    <button
                      onClick={() => handlePlayoffTeamCountChange(Math.min(numTeams, playoffTeamCount + 2))}
                      disabled={playoffTeamCount >= numTeams || (playoffTeamCount + 2) > numTeams}
                      className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shrink-0"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Requirement 3: Playoff Rounds Count & Requirement 6: Championship Games */}
                <div>
                  <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Playoff Rounds & Champ Games
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <select
                        value={playoffRoundsCount}
                        onChange={(e) => setPlayoffRoundsCount(parseInt(e.target.value, 10))}
                        aria-label="Playoff Rounds Count"
                        className="w-full py-2.5 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs font-bold"
                      >
                        {[1, 2, 3, 4, 5].map(r => (
                          <option key={r} value={r}>{r} Playoff Round{r > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <select
                        value={championshipGamesCount}
                        onChange={(e) => setChampionshipGamesCount(parseInt(e.target.value, 10))}
                        aria-label="Championship Games Count"
                        className="w-full py-2.5 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs font-bold"
                      >
                        {[1, 3, 5, 7].map(g => (
                          <option key={g} value={g}>{g} Champ Game{g > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>
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
                  Top {playoffTeamCount} teams on the ladder advance to the Playoffs.
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
                  onClick={advanceToPlotform}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition active:scale-98 cursor-pointer ${
                    completedQualifyingMatches === rounds.reduce((acc, r) => acc + r.length, 0)
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span>Proceed to Playoffs</span>
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
                    Top {playoffTeamCount} Qualify
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
                        const isQualifying = idx < playoffTeamCount;
                        return (
                          <tr
                            key={team.id}
                            className={`transition-colors ${
                              isQualifying
                                ? 'bg-blue-50/60 dark:bg-blue-950/30'
                                : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="py-3 pl-4 pr-2 font-mono font-bold">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                                  isQualifying
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
                                {isQualifying && (
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
        {/* STAGE 2: PLAYOFFS STAGE                                               */}
        {/* ===================================================================== */}
        {stage === 'playoffs' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold tracking-tight truncate">Stage 2: Playoffs ({playoffTeamCount} Teams, {playoffRounds.length} Rounds)</h2>
                  {playoffTeamCount === 6 && (
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                      Top 2 Teams Swapped for Doubles
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Playoff doubles randomized. Top 2 ranked teams/players advance to Championship.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={simulateAllPlayoffs}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition active:scale-98 cursor-pointer shadow-2xs"
                >
                  <Play className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Simulate All Playoffs</span>
                </button>
                <button
                  onClick={advanceToChampionship}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition active:scale-98 cursor-pointer ${
                    completedPlayoffMatches === totalPlayoffMatchesCount
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span>Proceed to Championship</span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </div>

            {/* Playoff Teams Overview Grid */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-5 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3.5 truncate">
                Qualified Playoff Teams & Randomized/Swapped Doubles
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {qualifiedPlayoffTeams.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 min-w-0"
                  >
                    <div className="text-xs font-extrabold text-blue-600 dark:text-blue-400 mb-1.5 truncate">
                      {t.name}
                    </div>
                    <div className="flex items-center gap-1.5 py-0.5 min-w-0 text-xs font-medium">
                      <BadgeA /> <span className="truncate">{t.playerA}</span>
                    </div>
                    <div className="flex items-center gap-1.5 py-0.5 mt-0.5 min-w-0 text-xs font-medium">
                      <BadgeB /> <span className="truncate">{t.playerB}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Playoff Matches & Standings Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left Column: Playoff Round Schedule */}
              <div className="xl:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden min-w-0">
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/40">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    {playoffRounds.map((roundMatches, idx) => {
                      const rNum = idx + 1;
                      const doneCount = roundMatches.filter(
                        m => m.score1 !== '' && m.score2 !== '' && m.score1 !== m.score2
                      ).length;
                      const isComplete = doneCount === roundMatches.length;
                      return (
                        <button
                          key={rNum}
                          onClick={() => setActivePlayoffRoundTab(rNum)}
                          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                            activePlayoffRoundTab === rNum
                              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80'
                          }`}
                        >
                          <span>Playoff Round {rNum}</span>
                          {isComplete && (
                            <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${activePlayoffRoundTab === rNum ? 'text-blue-200' : 'text-emerald-500'}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => simulateSinglePlayoffRound(activePlayoffRoundTab - 1)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition cursor-pointer shrink-0"
                  >
                    <Play className="w-3.5 h-3.5 shrink-0" />
                    <span>Simulate PR{activePlayoffRoundTab}</span>
                  </button>
                </div>

                <div className="p-4 sm:p-5 space-y-3.5">
                  {(playoffRounds[activePlayoffRoundTab - 1] || []).map((match, mIdx) => {
                    const t1 = playoffTeamMap[match.team1Id];
                    const t2 = playoffTeamMap[match.team2Id];
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

                        {/* Scores */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={3}
                            value={match.score1}
                            onChange={(e) => handlePlayoffScoreChange(activePlayoffRoundTab - 1, mIdx, 'score1', e.target.value)}
                            placeholder="0"
                            aria-label={`${t1.name} playoff score`}
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
                            onChange={(e) => handlePlayoffScoreChange(activePlayoffRoundTab - 1, mIdx, 'score2', e.target.value)}
                            placeholder="0"
                            aria-label={`${t2.name} playoff score`}
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

              {/* Right Column: Playoff Standings (Requirement 4: Top 2 proceed to championship) */}
              <div className="xl:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden min-w-0">
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ListOrdered className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <h3 className="font-bold text-sm sm:text-base truncate">Playoff Standings</h3>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
                    Top 2 ➔ Championship
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[340px]">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/40 dark:bg-slate-900/20">
                        <th className="py-3 pl-4 pr-2">Rank</th>
                        <th className="py-3 px-2">Team & Players</th>
                        <th className="py-3 px-2 text-center">W</th>
                        <th className="py-3 px-2 text-center">Diff</th>
                        <th className="py-3 pl-2 pr-4 text-center">PF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                      {playoffStandings.map((team, idx) => {
                        const isTop2 = idx < 2;
                        return (
                          <tr
                            key={team.id}
                            className={`transition-colors ${
                              isTop2
                                ? 'bg-blue-50/60 dark:bg-blue-950/30'
                                : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="py-3 pl-4 pr-2 font-mono font-bold">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                                  isTop2
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
                                {isTop2 && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/80 text-blue-700 dark:text-blue-300 shrink-0">
                                    Finalist
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
        {/* STAGE 3: CHAMPIONSHIP SERIES                                          */}
        {/* ===================================================================== */}
        {stage === 'championship' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2.5 min-w-0">
                  <Trophy className="w-6 h-6 text-blue-500 shrink-0" />
                  <span className="truncate">Stage 3: Championship Series ({championshipMatches.length} Games)</span>
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Top 2 playoff teams players have been swapped for the championship matchup series.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={simulateChampionshipSeries}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25 transition active:scale-98 cursor-pointer"
                >
                  <Play className="w-4 h-4 shrink-0" />
                  <span>Simulate Series</span>
                </button>
              </div>
            </div>

            {/* Celebratory Champions Banner */}
            {championshipWinner && (
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
                        {championshipWinner.playerA} & {championshipWinner.playerB}
                      </h3>
                      <p className="text-white/90 text-sm mt-1 font-medium truncate">
                        {championshipWinner.name} • Series Victory: <span className="font-bold underline decoration-white/40">{championshipWinner.wins}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Championship Games List */}
            <div className="space-y-4">
              {championshipMatches.map((match, mIdx) => {
                const s1 = parseInt(match.score1, 10);
                const s2 = parseInt(match.score2, 10);
                const hasWinner = !isNaN(s1) && !isNaN(s2) && s1 !== s2;
                const t1Won = hasWinner && s1 > s2;
                const t2Won = hasWinner && s2 > s1;

                return (
                  <div key={match.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        Championship Game {match.gameNumber}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center min-w-0">
                      {/* Team 1 */}
                      <div className={`md:col-span-5 p-4 rounded-2xl border transition-all min-w-0 ${
                        t1Won ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20' : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                      }`}>
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <span className="text-xs font-bold text-slate-500 uppercase">Finalist Team 1 (Swapped)</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={3}
                            value={match.score1}
                            onChange={(e) => handleChampionshipScoreChange(mIdx, 'score1', e.target.value)}
                            placeholder="0"
                            className="w-14 h-12 text-center font-bold text-base rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs"
                          />
                        </div>
                        <div className="space-y-1.5 text-sm font-bold">
                          <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-800">
                            <span className="truncate">{match.team1.playerA}</span> <BadgeA />
                          </div>
                          <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-800">
                            <span className="truncate">{match.team1.playerB}</span> <BadgeB />
                          </div>
                        </div>
                      </div>

                      {/* VS */}
                      <div className="md:col-span-1 flex justify-center py-2">
                        <span className="font-extrabold text-xs text-slate-400">VS</span>
                      </div>

                      {/* Team 2 */}
                      <div className={`md:col-span-5 p-4 rounded-2xl border transition-all min-w-0 ${
                        t2Won ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20' : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                      }`}>
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <span className="text-xs font-bold text-slate-500 uppercase">Finalist Team 2 (Swapped)</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={3}
                            value={match.score2}
                            onChange={(e) => handleChampionshipScoreChange(mIdx, 'score2', e.target.value)}
                            placeholder="0"
                            className="w-14 h-12 text-center font-bold text-base rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs"
                          />
                        </div>
                        <div className="space-y-1.5 text-sm font-bold">
                          <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-800">
                            <span className="truncate">{match.team2.playerA}</span> <BadgeA />
                          </div>
                          <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-800">
                            <span className="truncate">{match.team2.playerB}</span> <BadgeB />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
