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
  Minus,
  ArrowLeftRight,
  ShieldCheck
} from 'lucide-react';

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

/**
 * Generates a normalized, case-insensitive key for a pair of players
 * so we can reliably detect if two players were already partners in an earlier stage.
 */
const getPairKey = (player1, player2) => {
  return [String(player1).trim().toLowerCase(), String(player2).trim().toLowerCase()]
    .sort()
    .join('::');
};

export default function App() {
  const [stage, setStage] = useState('setup'); // 'setup' | 'qualifying' | 'playoffs' | 'championship'
  const [errorMsg, setErrorMsg] = useState('');

  // Setup configuration state
  const [totalPlayers, setTotalPlayers] = useState(24);
  const [matchesPerTeam, setMatchesPerTeam] = useState(5);
  const [bestOfCount, setBestOfCount] = useState(3); // Best of 1, 3, 5, 7

  // Player Inputs array
  const [playerInputs, setPlayerInputs] = useState(Array(24).fill(''));

  // Stage 1: Qualifying Teams & Schedule
  const [teams, setTeams] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [activeRoundTab, setActiveRoundTab] = useState(1);

  // Stage 2: 8-Team Playoffs & Semis State
  const [playoffTeams, setPlayoffTeams] = useState([]); // 8 teams after adjacent rank partner swap (ranks 1..8)
  const [playoffMatches, setPlayoffMatches] = useState([]); // 4 matches: [M1(1v8), M2(4v5), M3(2v7), M4(3v6)]
  const [semiMatches, setSemiMatches] = useState([]); // 2 matches: [S1(1v4), S2(2v3)] after swapping winners of adjacent rank

  // Stage 3: Championship State
  const [championshipTeams, setChampionshipTeams] = useState(null); // { team1, team2 } after swapping semi winners
  const [championshipMatches, setChampionshipMatches] = useState([]);

  // --- HANDLERS: Player & Series Configuration ---
  const handlePlayerCountChange = (newCount) => {
    if (newCount < 16 || newCount > 32 || newCount % 2 !== 0) return;
    setTotalPlayers(newCount);

    setPlayerInputs(prev => {
      if (newCount > prev.length) {
        return [...prev, ...Array(newCount - prev.length).fill('')];
      }
      return prev.slice(0, newCount);
    });

    const newNumTeams = newCount / 2;
    const maxAllowed = newNumTeams - 1;
    if (matchesPerTeam > maxAllowed) {
      setMatchesPerTeam(Math.max(1, maxAllowed));
    }
    setErrorMsg('');
  };

  const handlePlayerChange = (index, value) => {
    const updated = [...playerInputs];
    updated[index] = value;
    setPlayerInputs(updated);
    if (errorMsg) setErrorMsg('');
  };

  const handleAutoFill = () => {
    setPlayerInputs(Array(totalPlayers).fill('').map((_, i) => SAMPLE_NAMES[i % SAMPLE_NAMES.length]));
    setErrorMsg('');
  };

  const handleClearInputs = () => {
    setPlayerInputs(Array(totalPlayers).fill(''));
    setErrorMsg('');
  };

  // --- HELPERS ---
  const shuffleArray = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const generateRandomScores = (min = 11, max = 21) => {
    const s1 = Math.floor(Math.random() * (max - min + 1)) + min;
    let s2 = Math.floor(Math.random() * (max - min + 1)) + min;
    while (s2 === s1) {
      s2 = Math.floor(Math.random() * (max - min + 1)) + min;
    }
    return [String(s1), String(s2)];
  };

  /**
   * Builds a cumulative Set of normalized pair keys from all historical stages
   * (Qualifying teams, 8-Team Playoff teams, and Semifinal teams).
   */
  const buildPastPartnershipsSet = ({
    includeQualifying = true,
    includePlayoffs = false,
    includeSemis = false
  } = {}) => {
    const history = new Set();

    if (includeQualifying) {
      teams.forEach(t => {
        if (t?.playerA && t?.playerB) {
          history.add(getPairKey(t.playerA, t.playerB));
        }
      });
    }

    if (includePlayoffs) {
      playoffTeams.forEach(t => {
        if (t?.playerA && t?.playerB) {
          history.add(getPairKey(t.playerA, t.playerB));
        }
      });
    }

    if (includeSemis) {
      semiMatches.forEach(sm => {
        if (sm?.team1?.playerA && sm?.team1?.playerB) {
          history.add(getPairKey(sm.team1.playerA, sm.team1.playerB));
        }
        if (sm?.team2?.playerA && sm?.team2?.playerB) {
          history.add(getPairKey(sm.team2.playerA, sm.team2.playerB));
        }
      });
    }

    return history;
  };

  /**
   * Resolves a single adjacent pair (t1, t2) while avoiding any partnership already in `pastPartnershipsSet`.
   * 1. Checks standard cross-swap: (t1.A + t2.B) and (t2.A + t1.B)
   * 2. If either is a repeat partnership, checks alternative cross-swap: (t1.A + t2.A) and (t1.B + t2.B)
   * 3. Returns the chosen pairings alongside metadata indicating if an alternate swap was used.
   */
  const resolveAdjacentPair = (t1, t2, pastPartnershipsSet) => {
    // Option 1: Standard A<->B cross-swap
    const stdP1 = [t1.playerA, t2.playerB];
    const stdP2 = [t2.playerA, t1.playerB];
    const stdHasRepeat =
      pastPartnershipsSet.has(getPairKey(stdP1[0], stdP1[1])) ||
      pastPartnershipsSet.has(getPairKey(stdP2[0], stdP2[1]));

    if (!stdHasRepeat) {
      return {
        pair1: stdP1,
        pair2: stdP2,
        isAlternateSwap: false,
        swapNote: null,
        repeatCount: 0
      };
    }

    // Option 2: Alternative A<->A and B<->B cross-swap
    const altP1 = [t1.playerA, t2.playerA];
    const altP2 = [t1.playerB, t2.playerB];
    const altRepeatCount =
      (pastPartnershipsSet.has(getPairKey(altP1[0], altP1[1])) ? 1 : 0) +
      (pastPartnershipsSet.has(getPairKey(altP2[0], altP2[1])) ? 1 : 0);

    if (altRepeatCount === 0) {
      return {
        pair1: altP1,
        pair2: altP2,
        isAlternateSwap: true,
        swapNote: 'Alt Swap (A↔A / B↔B) • Repeat Avoided',
        repeatCount: 0
      };
    }

    // Fallback: pick whichever option yields fewer repeat partnerships
    const stdRepeatCount =
      (pastPartnershipsSet.has(getPairKey(stdP1[0], stdP1[1])) ? 1 : 0) +
      (pastPartnershipsSet.has(getPairKey(stdP2[0], stdP2[1])) ? 1 : 0);

    if (altRepeatCount < stdRepeatCount) {
      return {
        pair1: altP1,
        pair2: altP2,
        isAlternateSwap: true,
        swapNote: 'Alt Swap (A↔A / B↔B) • Min Repeats',
        repeatCount: altRepeatCount
      };
    }

    return {
      pair1: stdP1,
      pair2: stdP2,
      isAlternateSwap: false,
      swapNote: null,
      repeatCount: stdRepeatCount
    };
  };

  /**
   * Swaps partners for adjacent ranked teams while checking `pastPartnershipsSet`
   * so players who have already been partners are paired using alternative combinations.
   * Also checks 4-team adjacent block rotations if a direct 2-team swap still contains a repeat.
   */
  const swapAdjacentRankPartners = (rankedList, idPrefix = 'PT', pastPartnershipsSet = new Set()) => {
    const swapped = [];
    let i = 0;

    while (i < rankedList.length) {
      const t1 = rankedList[i];
      const t2 = rankedList[i + 1];

      if (t1 && t2) {
        const directResult = resolveAdjacentPair(t1, t2, pastPartnershipsSet);

        // If direct adjacent pair (i, i+1) still has a repeat AND a second adjacent pair (i+2, i+3) exists,
        // evaluate 4-team adjacent block combinations to eliminate all repeat partnerships.
        const t3 = rankedList[i + 2];
        const t4 = rankedList[i + 3];
        if (directResult.repeatCount > 0 && t3 && t4) {
          const blockTeams = [t1, t2, t3, t4];
          const players = blockTeams.flatMap((t, idx) => [
            { name: t.playerA, teamIdx: idx },
            { name: t.playerB, teamIdx: idx }
          ]);

          // Candidate 4-team block pairings where no player stays with their current teammate
          // and adjacent proximity is preserved (e.g., (0,2)+(1,3) or cross-block (0-3) rotations)
          const blockPatterns = [
            // Cross-block adjacent rotation: (t1↔t3) and (t2↔t4)
            [[0, 4], [1, 5], [2, 6], [3, 7]],
            [[0, 5], [1, 4], [2, 7], [3, 6]],
            // Outer-inner adjacent block rotation: (t1↔t4) and (t2↔t3)
            [[0, 6], [1, 7], [2, 4], [3, 5]],
            [[0, 7], [1, 6], [2, 5], [3, 4]]
          ];

          let bestBlockChoice = null;
          for (const pattern of blockPatterns) {
            const hasRepeat = pattern.some(([pIdxA, pIdxB]) =>
              pastPartnershipsSet.has(getPairKey(players[pIdxA].name, players[pIdxB].name))
            );
            if (!hasRepeat) {
              bestBlockChoice = pattern.map(([pIdxA, pIdxB]) => [
                players[pIdxA].name,
                players[pIdxB].name
              ]);
              break;
            }
          }

          if (bestBlockChoice) {
            bestBlockChoice.forEach((pair, offset) => {
              const rankNum = i + offset + 1;
              swapped.push({
                id: `${idPrefix}-${rankNum}`,
                seedRank: rankNum,
                name: `Seed #${rankNum}`,
                playerA: pair[0],
                playerB: pair[1],
                isAlternateSwap: true,
                swapNote: 'Adjacent Block Swap • Repeat Avoided'
              });
            });
            i += 4;
            continue;
          }
        }

        const rank1 = i + 1;
        const rank2 = i + 2;

        swapped.push({
          id: `${idPrefix}-${rank1}`,
          seedRank: rank1,
          name: `Seed #${rank1}`,
          playerA: directResult.pair1[0],
          playerB: directResult.pair1[1],
          isAlternateSwap: directResult.isAlternateSwap,
          swapNote: directResult.swapNote,
          swappedFrom: `${t1.playerA} & ${t1.playerB} ↔ ${t2.playerA} & ${t2.playerB}`
        });
        swapped.push({
          id: `${idPrefix}-${rank2}`,
          seedRank: rank2,
          name: `Seed #${rank2}`,
          playerA: directResult.pair2[0],
          playerB: directResult.pair2[1],
          isAlternateSwap: directResult.isAlternateSwap,
          swapNote: directResult.swapNote,
          swappedFrom: `${t1.playerA} & ${t1.playerB} ↔ ${t2.playerA} & ${t2.playerB}`
        });
        i += 2;
      } else if (t1) {
        const rank1 = i + 1;
        swapped.push({
          id: `${idPrefix}-${rank1}`,
          seedRank: rank1,
          name: `Seed #${rank1}`,
          playerA: t1.playerA,
          playerB: t1.playerB,
          isAlternateSwap: false,
          swapNote: null
        });
        i += 1;
      }
    }

    return swapped;
  };

  // --- START QUALIFYING ---
  const startTournament = () => {
    const cleaned = playerInputs.map((p, idx) => p.trim() || `Player ${String(idx + 1).padStart(2, '0')}`);
    const uniqueCheck = new Set(cleaned.map(n => n.toLowerCase()));
    if (uniqueCheck.size !== totalPlayers) {
      setErrorMsg(`Please ensure all ${totalPlayers} player names are unique.`);
      return;
    }

    const numTeams = totalPlayers / 2;
    if (numTeams < 8) {
      setErrorMsg('At least 16 players (8 teams) are required for an 8-team playoff bracket.');
      return;
    }

    const maxMatches = numTeams - 1;
    if (matchesPerTeam < 1 || matchesPerTeam > maxMatches) {
      setErrorMsg(`Matches per team must be between 1 and ${maxMatches} for ${numTeams} teams.`);
      return;
    }

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

    const generatedRounds = [];
    const oppositionHistory = {};
    createdTeams.forEach(t => { oppositionHistory[t.id] = new Set(); });

    let scheduleFailed = false;

    for (let r = 1; r <= matchesPerTeam; r++) {
      const matches = [];
      let roundValid = false;
      let attempts = 0;

      while (!roundValid && attempts < 120) {
        attempts++;
        const availableTeams = shuffleArray([...createdTeams]);
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
            oppositionHistory[pair.t1.id].add(pair.t2.id);
            oppositionHistory[pair.t2.id].add(pair.t1.id);
            matches.push({
              id: `R${r}-M${idx + 1}`,
              round: r,
              team1Id: pair.t1.id,
              team2Id: pair.t2.id,
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
      setErrorMsg('Could not generate a non-repeating schedule. Try re-randomizing.');
      return;
    }

    setTeams(createdTeams);
    setRounds(generatedRounds);
    setActiveRoundTab(1);
    setPlayoffTeams([]);
    setPlayoffMatches([]);
    setSemiMatches([]);
    setChampionshipTeams(null);
    setChampionshipMatches([]);
    setErrorMsg('');
    setStage('qualifying');
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
      stats[t.id] = { ...t, played: 0, wins: 0, losses: 0, pf: 0, pa: 0, diff: 0 };
    });

    rounds.forEach(roundMatches => {
      roundMatches.forEach(m => {
        const s1 = parseInt(m.score1, 10);
        const s2 = parseInt(m.score2, 10);
        if (m.score1 !== '' && m.score2 !== '' && !isNaN(s1) && !isNaN(s2) && s1 !== s2) {
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

  const totalQualifyingMatchesCount = useMemo(
    () => rounds.reduce((acc, r) => acc + r.length, 0),
    [rounds]
  );

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
          const s1 = parseInt(m.score1, 10);
          const s2 = parseInt(m.score2, 10);
          if (m.score1 !== '' && m.score2 !== '' && !isNaN(s1) && !isNaN(s2) && s1 !== s2) {
            return m;
          }
          const [ns1, ns2] = generateRandomScores(10, 21);
          return { ...m, score1: ns1, score2: ns2 };
        })
      )
    );
    setErrorMsg('');
  };

  // --- STAGE 2: 8-TEAM PLAYOFF BRACKET ---
  const proceedToPlayoffs = () => {
    if (completedQualifyingMatches < totalQualifyingMatchesCount) {
      setErrorMsg(`Complete all ${totalQualifyingMatchesCount} qualifying matches first (${completedQualifyingMatches}/${totalQualifyingMatchesCount}).`);
      return;
    }

    const top8 = ladderStandings.slice(0, 8);
    // Track all Qualifying partnerships so adjacent swaps avoid repeating any qualifying duo
    const qualifyingHistory = buildPastPartnershipsSet({ includeQualifying: true });

    // Swap partner of adjacent rank: 1<->2, 3<->4, 5<->6, 7<->8 (checking alternate combinations if needed)
    const swapped8 = swapAdjacentRankPartners(top8, 'PO', qualifyingHistory);

    // Bracket pairings (0-indexed in swapped8: 0=Rank1, 1=Rank2, 2=Rank3, 3=Rank4, 4=Rank5, 5=Rank6, 6=Rank7, 7=Rank8)
    const initialPlayoffMatches = [
      { id: 'PM-1', label: 'Match 1: Rank 1 vs Rank 8', team1Id: swapped8[0].id, team2Id: swapped8[7].id, score1: '', score2: '' },
      { id: 'PM-2', label: 'Match 2: Rank 4 vs Rank 5', team1Id: swapped8[3].id, team2Id: swapped8[4].id, score1: '', score2: '' },
      { id: 'PM-3', label: 'Match 3: Rank 2 vs Rank 7', team1Id: swapped8[1].id, team2Id: swapped8[6].id, score1: '', score2: '' },
      { id: 'PM-4', label: 'Match 4: Rank 3 vs Rank 6', team1Id: swapped8[2].id, team2Id: swapped8[5].id, score1: '', score2: '' }
    ];

    setPlayoffTeams(swapped8);
    setPlayoffMatches(initialPlayoffMatches);
    setSemiMatches([]);
    setChampionshipTeams(null);
    setChampionshipMatches([]);
    setErrorMsg('');
    setStage('playoffs');
  };

  const playoffTeamMap = useMemo(() => {
    const map = {};
    playoffTeams.forEach(t => { map[t.id] = t; });
    return map;
  }, [playoffTeams]);

  const handlePlayoffScoreChange = (idx, field, val) => {
    if (val !== '' && !/^\d+$/.test(val)) return;
    setPlayoffMatches(prev => {
      const copy = prev.map(m => ({ ...m }));
      copy[idx][field] = val;
      return copy;
    });
    // Reset downstream semis/finals if playoff scores change
    setSemiMatches([]);
    setChampionshipTeams(null);
    setChampionshipMatches([]);
    setErrorMsg('');
  };

  const simulatePlayoffMatches = () => {
    setPlayoffMatches(prev =>
      prev.map(m => {
        const [s1, s2] = generateRandomScores(11, 21);
        return { ...m, score1: s1, score2: s2 };
      })
    );
    setSemiMatches([]);
    setChampionshipTeams(null);
    setChampionshipMatches([]);
    setErrorMsg('');
  };

  // Rank the 4 playoff winners based on point differential
  const rankedPlayoffWinners = useMemo(() => {
    if (playoffMatches.length < 4 || playoffTeams.length < 8) return [];
    const winners = [];

    for (const m of playoffMatches) {
      const s1 = parseInt(m.score1, 10);
      const s2 = parseInt(m.score2, 10);
      if (m.score1 === '' || m.score2 === '' || isNaN(s1) || isNaN(s2) || s1 === s2) {
        return [];
      }
      const t1 = playoffTeamMap[m.team1Id];
      const t2 = playoffTeamMap[m.team2Id];
      if (!t1 || !t2) return [];

      if (s1 > s2) {
        winners.push({
          ...t1,
          matchId: m.id,
          pf: s1,
          pa: s2,
          pointDiff: s1 - s2
        });
      } else {
        winners.push({
          ...t2,
          matchId: m.id,
          pf: s2,
          pa: s1,
          pointDiff: s2 - s1
        });
      }
    }

    return winners
      .sort((a, b) => {
        if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
        if (b.pf !== a.pf) return b.pf - a.pf;
        return a.seedRank - b.seedRank;
      })
      .map((w, idx) => ({
        ...w,
        winnerRank: idx + 1,
        winnerLabel: `Winner Rank #${idx + 1}`
      }));
  }, [playoffMatches, playoffTeams, playoffTeamMap]);

  // --- GENERATE SEMIFINALS FROM RANKED PLAYOFF WINNERS ---
  const generateSemifinals = () => {
    if (rankedPlayoffWinners.length < 4) {
      setErrorMsg('Please complete all 4 playoff matches with non-tied scores first.');
      return;
    }

    // Track all Qualifying AND 8-Team Playoff partnerships before swapping semifinalists
    const historyUpToPlayoffs = buildPastPartnershipsSet({
      includeQualifying: true,
      includePlayoffs: true
    });

    // Swap partner of adjacent rank among the 4 ranked winners: Rank 1 <-> Rank 2, Rank 3 <-> Rank 4
    // Automatically checks alternative cross-swaps or 4-team block swaps if players were already partners
    const swappedSemis = swapAdjacentRankPartners(rankedPlayoffWinners, 'SF', historyUpToPlayoffs);

    const builtSemis = [
      {
        id: 'SM-1',
        label: 'Semifinal Match 1: Top Rank (#1) vs Bottom Rank (#4)',
        team1: swappedSemis[0],
        team2: swappedSemis[3],
        score1: '',
        score2: ''
      },
      {
        id: 'SM-2',
        label: 'Semifinal Match 2: Rank #2 vs Rank #3',
        team1: swappedSemis[1],
        team2: swappedSemis[2],
        score1: '',
        score2: ''
      }
    ];

    setSemiMatches(builtSemis);
    setChampionshipTeams(null);
    setChampionshipMatches([]);
    setErrorMsg('');
  };

  const handleSemiScoreChange = (idx, field, val) => {
    if (val !== '' && !/^\d+$/.test(val)) return;
    setSemiMatches(prev => {
      const copy = prev.map(m => ({ ...m }));
      copy[idx][field] = val;
      return copy;
    });
    setChampionshipTeams(null);
    setChampionshipMatches([]);
    setErrorMsg('');
  };

  const simulateSemifinals = () => {
    setSemiMatches(prev =>
      prev.map(m => {
        const [s1, s2] = generateRandomScores(11, 21);
        return { ...m, score1: s1, score2: s2 };
      })
    );
    setChampionshipTeams(null);
    setChampionshipMatches([]);
    setErrorMsg('');
  };

  const semifinalWinners = useMemo(() => {
    if (semiMatches.length < 2) return [];
    const winners = [];
    for (const m of semiMatches) {
      const s1 = parseInt(m.score1, 10);
      const s2 = parseInt(m.score2, 10);
      if (m.score1 === '' || m.score2 === '' || isNaN(s1) || isNaN(s2) || s1 === s2) {
        return [];
      }
      winners.push(s1 > s2 ? m.team1 : m.team2);
    }
    return winners;
  }, [semiMatches]);

  // --- PROCEED TO CHAMPIONSHIP (SWAP SEMIFINAL WINNERS + BEST OF N) ---
  const proceedToChampionship = () => {
    if (semifinalWinners.length < 2) {
      setErrorMsg('Complete both semifinal matches with non-tied scores to advance to the Championship.');
      return;
    }

    const w1 = semifinalWinners[0];
    const w2 = semifinalWinners[1];

    // Check full partnership history across Qualifying, Playoffs, and Semifinals
    const fullTournamentHistory = buildPastPartnershipsSet({
      includeQualifying: true,
      includePlayoffs: true,
      includeSemis: true
    });

    const resolvedFinalPair = resolveAdjacentPair(w1, w2, fullTournamentHistory);

    const finalTeam1 = {
      id: 'CH-1',
      name: 'Championship Team 1',
      playerA: resolvedFinalPair.pair1[0],
      playerB: resolvedFinalPair.pair1[1],
      isAlternateSwap: resolvedFinalPair.isAlternateSwap,
      swapNote: resolvedFinalPair.swapNote
    };
    const finalTeam2 = {
      id: 'CH-2',
      name: 'Championship Team 2',
      playerA: resolvedFinalPair.pair2[0],
      playerB: resolvedFinalPair.pair2[1],
      isAlternateSwap: resolvedFinalPair.isAlternateSwap,
      swapNote: resolvedFinalPair.swapNote
    };

    const games = [];
    for (let g = 1; g <= bestOfCount; g++) {
      games.push({
        id: `CG-${g}`,
        gameNumber: g,
        score1: '',
        score2: ''
      });
    }

    setChampionshipTeams({ team1: finalTeam1, team2: finalTeam2 });
    setChampionshipMatches(games);
    setErrorMsg('');
    setStage('championship');
  };

  const handleChampionshipScoreChange = (idx, field, val) => {
    if (val !== '' && !/^\d+$/.test(val)) return;
    setChampionshipMatches(prev => {
      const copy = prev.map(m => ({ ...m }));
      copy[idx][field] = val;
      return copy;
    });
    setErrorMsg('');
  };

  const simulateChampionship = () => {
    const winsNeeded = Math.ceil(bestOfCount / 2);
    let t1Wins = 0;
    let t2Wins = 0;

    setChampionshipMatches(prev =>
      prev.map(m => {
        if (t1Wins >= winsNeeded || t2Wins >= winsNeeded) {
          return { ...m, score1: '', score2: '' };
        }
        const [s1, s2] = generateRandomScores(15, 21);
        const n1 = parseInt(s1, 10);
        const n2 = parseInt(s2, 10);
        if (n1 > n2) t1Wins++;
        else t2Wins++;
        return { ...m, score1: s1, score2: s2 };
      })
    );
    setErrorMsg('');
  };

  const championshipSummary = useMemo(() => {
    if (!championshipTeams || championshipMatches.length === 0) return null;
    const winsNeeded = Math.ceil(bestOfCount / 2);
    let t1Wins = 0;
    let t2Wins = 0;

    championshipMatches.forEach(m => {
      const s1 = parseInt(m.score1, 10);
      const s2 = parseInt(m.score2, 10);
      if (m.score1 !== '' && m.score2 !== '' && !isNaN(s1) && !isNaN(s2) && s1 !== s2) {
        if (s1 > s2) t1Wins++;
        else t2Wins++;
      }
    });

    let champion = null;
    if (t1Wins >= winsNeeded) {
      champion = { ...championshipTeams.team1, seriesRecord: `${t1Wins} - ${t2Wins}` };
    } else if (t2Wins >= winsNeeded) {
      champion = { ...championshipTeams.team2, seriesRecord: `${t2Wins} - ${t1Wins}` };
    }

    return { t1Wins, t2Wins, winsNeeded, champion };
  }, [championshipTeams, championshipMatches, bestOfCount]);

  const resetTournament = () => {
    setStage('setup');
    setTeams([]);
    setRounds([]);
    setPlayoffTeams([]);
    setPlayoffMatches([]);
    setSemiMatches([]);
    setChampionshipTeams(null);
    setChampionshipMatches([]);
    setErrorMsg('');
  };

  const BadgeA = () => (
    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold tracking-wider uppercase rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
      A
    </span>
  );

  const BadgeB = () => (
    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold tracking-wider uppercase rounded-md bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200 dark:border-sky-800 shrink-0">
      B
    </span>
  );

  const AltSwapBadge = ({ note }) => {
    if (!note) return null;
    return (
      <span
        title="Alternative adjacent swap combination used to avoid repeating an earlier partnership"
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100/90 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/80"
      >
        <ShieldCheck className="w-3 h-3 shrink-0" />
        <span>{note}</span>
      </span>
    );
  };

  const numTeams = totalPlayers / 2;

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight truncate">
              The Great Divide Open Play
            </h1>
          </div>

          {stage !== 'setup' && (
            <button
              onClick={resetTournament}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shrink-0"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Stage Stepper */}
        <div className="bg-slate-100/70 dark:bg-slate-900/50 border-t border-slate-200/60 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2 overflow-x-auto">
            {[
              { id: 'setup', label: '0. Setup', icon: UserPlus, enabled: true },
              { id: 'qualifying', label: '1. Qualifying', icon: ListOrdered, enabled: teams.length > 0 },
              { id: 'playoffs', label: '2. 8-Team Playoffs & Semis', icon: Swords, enabled: playoffTeams.length === 8 },
              { id: 'championship', label: `3. Championship (Best of ${bestOfCount})`, icon: Trophy, enabled: Boolean(championshipTeams) }
            ].map((tab, idx) => {
              const Icon = tab.icon;
              const active = stage === tab.id;
              return (
                <React.Fragment key={tab.id}>
                  <button
                    disabled={!tab.enabled}
                    onClick={() => { setErrorMsg(''); setStage(tab.id); }}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : tab.enabled
                        ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 cursor-pointer'
                        : 'text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                  {idx < 3 && <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-3 text-rose-700 dark:text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {/* ===================================================================== */}
        {/* STAGE 0: SETUP                                                        */}
        {/* ===================================================================== */}
        {stage === 'setup' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-sm font-bold mb-2">
                  Total Players (Even, 16 - 32)
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handlePlayerCountChange(Math.max(16, totalPlayers - 2))}
                    disabled={totalPlayers <= 16}
                    className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 flex items-center justify-center font-bold disabled:opacity-40 cursor-pointer"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <div className="flex-1 text-center py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 font-mono font-bold text-sm">
                    {totalPlayers} Players ({numTeams} Teams)
                  </div>
                  <button
                    onClick={() => handlePlayerCountChange(Math.min(32, totalPlayers + 2))}
                    disabled={totalPlayers >= 32}
                    className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 flex items-center justify-center font-bold disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">
                  Playoff Bracket Format
                </label>
                <div className="py-2.5 px-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 text-xs sm:text-sm font-semibold text-blue-800 dark:text-blue-200">
                  8 Teams • Smart Adjacent Partner Swap (No Repeats) ➔ Semis
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">
                  Championship Series Format
                </label>
                <select
                  value={bestOfCount}
                  onChange={(e) => setBestOfCount(parseInt(e.target.value, 10))}
                  aria-label="Championship Best Of Format"
                  className="w-full py-2.5 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm font-bold"
                >
                  <option value={1}>Best of 1 Game</option>
                  <option value={3}>Best of 3 Games</option>
                  <option value={5}>Best of 5 Games</option>
                  <option value={7}>Best of 7 Games</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span>Player Roster ({totalPlayers})</span>
              </h2>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleAutoFill}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span>Auto-Fill Names</span>
                </button>
                <button
                  onClick={handleClearInputs}
                  className="px-3.5 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Clear
                </button>
                <button
                  onClick={startTournament}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25 transition cursor-pointer"
                >
                  <Shuffle className="w-4 h-4" />
                  <span>Randomize Teams & Start</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {playerInputs.map((name, idx) => (
                <div key={idx} className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-slate-400">
                    #{String(idx + 1).padStart(2, '0')}
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handlePlayerChange(idx, e.target.value)}
                    placeholder={`Player ${String(idx + 1).padStart(2, '0')}`}
                    className="w-full pl-12 pr-3.5 py-3 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* STAGE 1: QUALIFYING                                                   */}
        {/* ===================================================================== */}
        {stage === 'qualifying' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-xl font-bold">Stage 1: Qualifying Ladder</h2>
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {completedQualifyingMatches} / {totalQualifyingMatchesCount} Completed
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Top 8 teams qualify for the 8-team playoff bracket.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={startTournament}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 transition cursor-pointer"
                >
                  <Shuffle className="w-4 h-4 text-blue-600" />
                  <span>Re-Randomize</span>
                </button>
                <button
                  onClick={simulateAllQualifying}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition cursor-pointer"
                >
                  <Play className="w-4 h-4 text-emerald-600" />
                  <span>Simulate All</span>
                </button>
                <button
                  onClick={proceedToPlayoffs}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                    completedQualifyingMatches === totalQualifyingMatchesCount
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span>Start 8-Team Playoffs</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Generated Team Pairings Overview */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-3.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Generated Team Pairings ({teams.length} Teams)</span>
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {teams.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30"
                  >
                    <div className="text-xs font-extrabold text-blue-600 dark:text-blue-400 mb-1.5">
                      {t.name}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <BadgeA /> <span className="truncate">{t.playerA}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold mt-1">
                      <BadgeB /> <span className="truncate">{t.playerB}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Matches */}
              <div className="xl:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900/40">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {rounds.map((roundMatches, idx) => {
                      const rNum = idx + 1;
                      const isComplete = roundMatches.every(m => {
                        const s1 = parseInt(m.score1, 10);
                        const s2 = parseInt(m.score2, 10);
                        return m.score1 !== '' && m.score2 !== '' && !isNaN(s1) && !isNaN(s2) && s1 !== s2;
                      });
                      return (
                        <button
                          key={rNum}
                          onClick={() => setActiveRoundTab(rNum)}
                          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                            activeRoundTab === rNum
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span>Round {rNum}</span>
                          {isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => simulateSingleRound(activeRoundTab - 1)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Simulate R{activeRoundTab}</span>
                  </button>
                </div>

                <div className="p-4 sm:p-5 space-y-3">
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
                        className="p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between gap-3"
                      >
                        <div className={`flex-1 w-full sm:w-auto text-left sm:text-right ${t1Won ? 'font-bold text-blue-600 dark:text-blue-400' : ''}`}>
                          <div className="text-sm font-bold">{t1.name}</div>
                          <div className="mt-1 space-y-1 text-xs">
                            <div className="flex items-center sm:justify-end gap-1.5">
                              <span>{t1.playerA}</span> <BadgeA />
                            </div>
                            <div className="flex items-center sm:justify-end gap-1.5">
                              <span>{t1.playerB}</span> <BadgeB />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={3}
                            value={match.score1}
                            onChange={(e) => handleQualifyingScoreChange(activeRoundTab - 1, mIdx, 'score1', e.target.value)}
                            placeholder="0"
                            className="w-14 h-12 text-center font-bold text-base rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                          <span className="text-xs font-extrabold text-slate-400">VS</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={3}
                            value={match.score2}
                            onChange={(e) => handleQualifyingScoreChange(activeRoundTab - 1, mIdx, 'score2', e.target.value)}
                            placeholder="0"
                            className="w-14 h-12 text-center font-bold text-base rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                        </div>

                        <div className={`flex-1 w-full sm:w-auto text-left ${t2Won ? 'font-bold text-blue-600 dark:text-blue-400' : ''}`}>
                          <div className="text-sm font-bold">{t2.name}</div>
                          <div className="mt-1 space-y-1 text-xs">
                            <div className="flex items-center gap-1.5">
                              <BadgeA /> <span>{t2.playerA}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <BadgeB /> <span>{t2.playerB}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Standings */}
              <div className="xl:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
                  <h3 className="font-bold text-sm sm:text-base">Qualifying Standings</h3>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                    Top 8 Advance
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-400">
                        <th className="py-3 pl-4 pr-2">#</th>
                        <th className="py-3 px-2">Team</th>
                        <th className="py-3 px-2 text-center">W</th>
                        <th className="py-3 px-2 text-center">Diff</th>
                        <th className="py-3 pl-2 pr-4 text-center">PF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                      {ladderStandings.map((team, idx) => {
                        const qualifies = idx < 8;
                        return (
                          <tr key={team.id} className={qualifies ? 'bg-blue-50/60 dark:bg-blue-950/25' : ''}>
                            <td className="py-3 pl-4 pr-2 font-mono font-bold">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                                qualifies ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                              }`}>
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-3 px-2">
                              <div className="font-bold">{team.name}</div>
                              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1 mt-0.5">
                                <span>{team.playerA}</span> • <span>{team.playerB}</span>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-center font-bold">{team.wins}</td>
                            <td className={`py-3 px-2 text-center font-mono text-xs font-semibold ${
                              team.diff > 0 ? 'text-emerald-600' : team.diff < 0 ? 'text-rose-600' : 'text-slate-500'
                            }`}>
                              {team.diff > 0 ? `+${team.diff}` : team.diff}
                            </td>
                            <td className="py-3 pl-2 pr-4 text-center font-mono text-xs text-slate-500">{team.pf}</td>
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
        {/* STAGE 2: 8-TEAM PLAYOFFS & SEMIS                                      */}
        {/* ===================================================================== */}
        {stage === 'playoffs' && (
          <div className="space-y-8">
            {/* Playoff Header */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Swords className="w-5 h-5 text-blue-600" />
                  <span>Stage 2A: 8-Team Playoffs (Adjacent Partner Swap)</span>
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Partners swapped between adjacent ranks (1↔2, 3↔4, 5↔6, 7↔8), checking alternative combinations if players were already partners.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={simulatePlayoffMatches}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition cursor-pointer"
                >
                  <Play className="w-4 h-4 text-emerald-600" />
                  <span>Simulate 4 Playoff Matches</span>
                </button>
                <button
                  onClick={generateSemifinals}
                  disabled={rankedPlayoffWinners.length < 4}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                    rankedPlayoffWinners.length === 4
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Build Semifinals</span>
                </button>
              </div>
            </div>

            {/* Swapped 8 Playoff Teams Strip */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                8 Playoff Teams After Adjacent Rank Partner Swap
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {playoffTeams.map((t) => (
                  <div key={t.id} className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
                    <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">
                        {t.name}
                      </span>
                      <AltSwapBadge note={t.swapNote} />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <BadgeA /> <span className="truncate">{t.playerA}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold mt-1">
                      <BadgeB /> <span className="truncate">{t.playerB}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4 Playoff Bracket Matches + Ranked Winners Leaderboard */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <div className="xl:col-span-7 space-y-3.5">
                {playoffMatches.map((m, idx) => {
                  const t1 = playoffTeamMap[m.team1Id];
                  const t2 = playoffTeamMap[m.team2Id];
                  if (!t1 || !t2) return null;
                  const s1 = parseInt(m.score1, 10);
                  const s2 = parseInt(m.score2, 10);
                  const hasWinner = !isNaN(s1) && !isNaN(s2) && s1 !== s2;
                  const t1Won = hasWinner && s1 > s2;
                  const t2Won = hasWinner && s2 > s1;

                  return (
                    <div key={m.id} className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                        {m.label}
                      </div>
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className={`flex-1 w-full sm:w-auto text-left sm:text-right ${t1Won ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}`}>
                          <div className="text-sm font-bold">{t1.name} {t1Won && '• Winner'}</div>
                          {t1.swapNote && (
                            <div className="mt-1 flex sm:justify-end">
                              <AltSwapBadge note={t1.swapNote} />
                            </div>
                          )}
                          <div className="text-xs mt-1 space-y-1">
                            <div className="flex items-center sm:justify-end gap-1.5"><span>{t1.playerA}</span> <BadgeA /></div>
                            <div className="flex items-center sm:justify-end gap-1.5"><span>{t1.playerB}</span> <BadgeB /></div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={3}
                            value={m.score1}
                            onChange={(e) => handlePlayoffScoreChange(idx, 'score1', e.target.value)}
                            placeholder="0"
                            className="w-14 h-12 text-center font-bold text-base rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                          />
                          <span className="text-xs font-extrabold text-slate-400">VS</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={3}
                            value={m.score2}
                            onChange={(e) => handlePlayoffScoreChange(idx, 'score2', e.target.value)}
                            placeholder="0"
                            className="w-14 h-12 text-center font-bold text-base rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                          />
                        </div>

                        <div className={`flex-1 w-full sm:w-auto text-left ${t2Won ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}`}>
                          <div className="text-sm font-bold">{t2.name} {t2Won && '• Winner'}</div>
                          {t2.swapNote && (
                            <div className="mt-1">
                              <AltSwapBadge note={t2.swapNote} />
                            </div>
                          )}
                          <div className="text-xs mt-1 space-y-1">
                            <div className="flex items-center gap-1.5"><BadgeA /> <span>{t2.playerA}</span></div>
                            <div className="flex items-center gap-1.5"><BadgeB /> <span>{t2.playerB}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ranked Playoff Winners by Point Differential */}
              <div className="xl:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
                <h3 className="font-bold text-base mb-1">Playoff Winners Ranked by Point Diff</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Top 4 playoff winners are ranked by point differential before repeat-checked adjacent swapping for Semis.
                </p>

                {rankedPlayoffWinners.length < 4 ? (
                  <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-sm text-slate-400">
                    Enter scores for all 4 playoff matches to rank winners by point differential.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rankedPlayoffWinners.map((w) => (
                      <div key={w.id} className="p-3.5 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">
                              {w.winnerRank}
                            </span>
                            <span className="font-bold text-sm truncate">{w.winnerLabel} ({w.name})</span>
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 truncate">
                            {w.playerA} & {w.playerB}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                            {w.pointDiff > 0 ? `+${w.pointDiff}` : w.pointDiff} Diff
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {w.pf} - {w.pa}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ================================================================= */}
            {/* STAGE 2B: SEMIFINALS SECTION                                      */}
            {/* ================================================================= */}
            {semiMatches.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-blue-200 dark:border-blue-900/70 p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Swords className="w-5 h-5 text-blue-600" />
                      <span>Stage 2B: Semifinals (Repeat-Checked Adjacent Winners)</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      Adjacent winner partners swapped (1↔2, 3↔4) with automatic alternate swap fallback to prevent repeat partnerships.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={simulateSemifinals}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition cursor-pointer"
                    >
                      <Play className="w-4 h-4 text-emerald-600" />
                      <span>Simulate Semis</span>
                    </button>
                    <button
                      onClick={proceedToChampionship}
                      disabled={semifinalWinners.length < 2}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                        semifinalWinners.length === 2
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <span>Swap Winners & Championship</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {semiMatches.map((sm, idx) => {
                    const s1 = parseInt(sm.score1, 10);
                    const s2 = parseInt(sm.score2, 10);
                    const hasWinner = !isNaN(s1) && !isNaN(s2) && s1 !== s2;
                    const t1Won = hasWinner && s1 > s2;
                    const t2Won = hasWinner && s2 > s1;

                    return (
                      <div key={sm.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                        <div className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          {sm.label}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className={`flex-1 min-w-0 ${t1Won ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}`}>
                            <div className="text-sm font-bold truncate">{sm.team1.name} {t1Won && '• Finalist'}</div>
                            {sm.team1.swapNote && (
                              <div className="mt-1">
                                <AltSwapBadge note={sm.team1.swapNote} />
                              </div>
                            )}
                            <div className="mt-1 space-y-1 text-xs">
                              <div className="flex items-center gap-1.5">
                                <BadgeA /> <span className="truncate">{sm.team1.playerA}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <BadgeB /> <span className="truncate">{sm.team1.playerB}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={3}
                              value={sm.score1}
                              onChange={(e) => handleSemiScoreChange(idx, 'score1', e.target.value)}
                              placeholder="0"
                              className="w-14 h-11 text-center font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                            />
                            <span className="text-xs font-bold text-slate-400">VS</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={3}
                              value={sm.score2}
                              onChange={(e) => handleSemiScoreChange(idx, 'score2', e.target.value)}
                              placeholder="0"
                              className="w-14 h-11 text-center font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                            />
                          </div>
                          <div className={`flex-1 text-right min-w-0 ${t2Won ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}`}>
                            <div className="text-sm font-bold truncate">{sm.team2.name} {t2Won && '• Finalist'}</div>
                            {sm.team2.swapNote && (
                              <div className="mt-1 flex justify-end">
                                <AltSwapBadge note={sm.team2.swapNote} />
                              </div>
                            )}
                            <div className="mt-1 space-y-1 text-xs">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="truncate">{sm.team2.playerA}</span> <BadgeA />
                              </div>
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="truncate">{sm.team2.playerB}</span> <BadgeB />
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
          </div>
        )}

        {/* ===================================================================== */}
        {/* STAGE 3: CHAMPIONSHIP (SWAPPED WINNERS + BEST OF N)                   */}
        {/* ===================================================================== */}
        {stage === 'championship' && championshipTeams && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-blue-600" />
                  <span>Stage 3: Championship — Best of {bestOfCount}</span>
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Semifinal winners swapped partners with repeat-partnership prevention. First to {championshipSummary?.winsNeeded} game win(s) takes the title.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={bestOfCount}
                  onChange={(e) => {
                    const nextBo = parseInt(e.target.value, 10);
                    setBestOfCount(nextBo);
                    setChampionshipMatches(
                      Array.from({ length: nextBo }, (_, idx) => ({
                        id: `CG-${idx + 1}`,
                        gameNumber: idx + 1,
                        score1: '',
                        score2: ''
                      }))
                    );
                  }}
                  aria-label="Select Championship Best Of"
                  className="py-2.5 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                >
                  <option value={1}>Best of 1</option>
                  <option value={3}>Best of 3</option>
                  <option value={5}>Best of 5</option>
                  <option value={7}>Best of 7</option>
                </select>

                <button
                  onClick={simulateChampionship}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25 transition cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  <span>Simulate Best-of-{bestOfCount}</span>
                </button>
              </div>
            </div>

            {championshipSummary?.champion && (
              <div className="rounded-3xl bg-gradient-to-r from-blue-700 via-blue-600 to-sky-600 p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <Award className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider bg-white/20 px-3 py-0.5 rounded-full inline-block mb-1">
                      Champions
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-extrabold">
                      {championshipSummary.champion.playerA} & {championshipSummary.champion.playerB}
                    </h3>
                    <p className="text-sm text-white/90 mt-0.5">
                      {championshipSummary.champion.name} • Series: {championshipSummary.champion.seriesRecord} (Best of {bestOfCount})
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {championshipMatches.map((g, idx) => {
                const s1 = parseInt(g.score1, 10);
                const s2 = parseInt(g.score2, 10);
                const hasWinner = !isNaN(s1) && !isNaN(s2) && s1 !== s2;
                const t1Won = hasWinner && s1 > s2;
                const t2Won = hasWinner && s2 > s1;

                return (
                  <div key={g.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3">
                      Game {g.gameNumber} of Best of {bestOfCount}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
                      <div className={`md:col-span-5 p-4 rounded-2xl border ${t1Won ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold uppercase text-slate-500">{championshipTeams.team1.name}</span>
                            <AltSwapBadge note={championshipTeams.team1.swapNote} />
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={3}
                            value={g.score1}
                            onChange={(e) => handleChampionshipScoreChange(idx, 'score1', e.target.value)}
                            placeholder="0"
                            className="w-14 h-11 text-center font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                        </div>
                        <div className="text-sm font-bold flex items-center justify-between">
                          <span>{championshipTeams.team1.playerA} & {championshipTeams.team1.playerB}</span>
                          {t1Won && <span className="text-xs text-emerald-600 font-extrabold">WIN</span>}
                        </div>
                      </div>

                      <div className="md:col-span-1 text-center font-extrabold text-xs text-slate-400">VS</div>

                      <div className={`md:col-span-5 p-4 rounded-2xl border ${t2Won ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold uppercase text-slate-500">{championshipTeams.team2.name}</span>
                            <AltSwapBadge note={championshipTeams.team2.swapNote} />
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={3}
                            value={g.score2}
                            onChange={(e) => handleChampionshipScoreChange(idx, 'score2', e.target.value)}
                            placeholder="0"
                            className="w-14 h-11 text-center font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                        </div>
                        <div className="text-sm font-bold flex items-center justify-between">
                          <span>{championshipTeams.team2.playerA} & {championshipTeams.team2.playerB}</span>
                          {t2Won && <span className="text-xs text-emerald-600 font-extrabold">WIN</span>}
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
