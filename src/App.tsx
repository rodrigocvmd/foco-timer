import { useState, useEffect, useMemo, useCallback } from "react";

// Tone.js será carregado dinamicamente para o alerta sonoro.

// Defina uma interface global para o Tone.js para evitar erros de tipo
declare global {
	interface Window {
		Tone: any;
	}
}

function App() {
	// --- STATE MANAGEMENT (useState) ---
	const [focusDuration, setFocusDuration] = useState(50);
	const [breakDuration, setBreakDuration] = useState(10);
	const [mode, setMode] = useState("focus"); // 'focus' ou 'break'
	const [status, setStatus] = useState("idle"); // 'idle', 'running', ou 'paused'
	const [timeLeft, setTimeLeft] = useState(focusDuration * 60);
	const [completionMessage, setCompletionMessage] = useState("");
	const [deadline, setDeadline] = useState<number | null>(null);
	// Adicionado para evitar que o estado inicial substitua o estado guardado ao carregar
	const [isInitialized, setIsInitialized] = useState(false);

	// --- LOCAL STORAGE EFFECTS (CORRIGIDO) ---

	// Carrega o estado do localStorage na montagem inicial do componente
	useEffect(() => {
		try {
			const savedStateJSON = localStorage.getItem("pomodoroAppState");
			if (savedStateJSON) {
				const savedState = JSON.parse(savedStateJSON);
				setFocusDuration(savedState.focusDuration || 50);
				setBreakDuration(savedState.breakDuration || 10);
				setMode(savedState.mode || "focus");
				setCompletionMessage(savedState.completionMessage || "");

				// Lógica para resumir o estado corretamente
				if (savedState.status === "running" && savedState.deadline) {
					const remaining = savedState.deadline - Date.now();
					// Se ainda há tempo, define o estado como 'running' e o tempo restante
					if (remaining > 0) {
						setTimeLeft(Math.round(remaining / 1000));
						setStatus("running");
						setDeadline(savedState.deadline);
					} else {
						// Se o tempo acabou enquanto a aba estava fechada, aciona a conclusão
						setTimeLeft(0);
						setStatus("running"); // O useEffect do timer irá tratar a conclusão
						setDeadline(savedState.deadline);
					}
				} else {
					// Se estava pausado ou inativo, carrega o estado como estava
					setStatus(savedState.status || "idle");
					setTimeLeft(
						savedState.timeLeft !== undefined
							? savedState.timeLeft
							: (savedState.focusDuration || 50) * 60
					);
					setDeadline(null);
				}
			}
		} catch (error) {
			console.error("Falha ao carregar o estado do localStorage:", error);
			localStorage.removeItem("pomodoroAppState");
		}
		// Marca a inicialização como concluída para permitir que o estado seja guardado
		setIsInitialized(true);
	}, []); // Array vazio garante que isto só corre uma vez

	// Guarda o estado no localStorage sempre que ele muda, mas apenas após a inicialização
	useEffect(() => {
		if (!isInitialized) {
			return;
		}
		try {
			const stateToSave = {
				focusDuration,
				breakDuration,
				mode,
				status,
				timeLeft,
				completionMessage,
				deadline, // Adicionado para guardar o timestamp final
			};
			localStorage.setItem("pomodoroAppState", JSON.stringify(stateToSave));
		} catch (error) {
			console.error("Falha ao guardar o estado no localStorage:", error);
		}
	}, [
		focusDuration,
		breakDuration,
		mode,
		status,
		timeLeft,
		completionMessage,
		isInitialized,
		deadline,
	]); // Adicionada dependência 'deadline'

	// --- DERIVED STATE (useMemo) ---
	const displayTime = useMemo(() => {
		const minutes = Math.floor(timeLeft / 60);
		const seconds = timeLeft % 60;
		return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
	}, [timeLeft]);

	const headerMessage = useMemo(() => {
		if (status === "running") {
			return mode === "focus" ? "Hora de focar!" : "Faça uma pausa e relaxe.";
		}
		if (status === "paused") {
			return "Cronômetro pausado.";
		}
		return "Defina o tempo e inicie uma sessão.";
	}, [status, mode]);

	// --- SIDE EFFECTS (useEffect) ---
	useEffect(() => {
		const scriptId = "tone-js-script";
		if (document.getElementById(scriptId)) return;

		const script = document.createElement("script");
		script.id = scriptId;
		script.src = "https://cdnjs.cloudflare.com/ajax/libs/tone/14.7.77/Tone.min.js";
		script.async = true;
		document.body.appendChild(script);

		return () => {
			const existingScript = document.getElementById(scriptId);
			if (existingScript) {
				document.body.removeChild(existingScript);
			}
		};
	}, []);

	// --- EVENT HANDLERS & ACTIONS (useCallback) ---
	const playSound = useCallback(() => {
		if (typeof window.Tone !== "undefined") {
			const synth = new window.Tone.Synth().toDestination();
			synth.triggerAttackRelease("C4", "0.5");
		} else {
			console.warn("Tone.js não carregado. Não foi possível tocar o som.");
		}
	}, []);

	const handleTimerCompletion = useCallback(() => {
		setDeadline(null); // Limpa o deadline ao completar
		setStatus("idle");
		if (mode === "focus") {
			setMode("break");
			setCompletionMessage("Foco finalizado");
			setTimeLeft(breakDuration * 60);
		} else {
			setMode("focus");
			setCompletionMessage("Fim da pausa");
			setTimeLeft(focusDuration * 60);
			playSound();
		}
	}, [mode, breakDuration, focusDuration, playSound]);

	// --- LÓGICA DO TEMPORIZADOR (CORRIGIDO) ---
	useEffect(() => {
		if (timeLeft <= 0 && status === "running") {
			handleTimerCompletion();
			return;
		}

		let interval: number | undefined = undefined;

		if (status === "running" && deadline) {
			interval = setInterval(() => {
				const remaining = deadline - Date.now();
				setTimeLeft(Math.max(0, Math.round(remaining / 1000)));
			}, 1000);
		}

		return () => {
			if (interval) {
				clearInterval(interval);
			}
		};
	}, [status, deadline, timeLeft, handleTimerCompletion]);

	const startTimer = () => {
		setCompletionMessage("");
		setStatus("running");
		setDeadline(Date.now() + timeLeft * 1000);
	};

	const togglePause = () => {
		setStatus((prevStatus) => {
			if (prevStatus === "running") {
				// A pausar
				setDeadline(null);
				return "paused";
			}
			if (prevStatus === "paused") {
				// A retomar
				setDeadline(Date.now() + timeLeft * 1000);
				return "running";
			}
			return prevStatus;
		});
	};

	const resetTimer = () => {
		setStatus("idle");
		setDeadline(null);
		setCompletionMessage("");
		setTimeLeft((mode === "focus" ? focusDuration : breakDuration) * 60);
	};

	const resetToStart = () => {
		setMode("focus");
		setStatus("idle");
		setDeadline(null);
		setCompletionMessage("");
		setTimeLeft(focusDuration * 60);
	};

	const updateFocusDuration = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = parseInt(e.target.value, 10) || 1;
		setFocusDuration(value);
		if (status === "idle" && mode === "focus") {
			setTimeLeft(value * 60);
		}
	};

	const updateBreakDuration = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = parseInt(e.target.value, 10) || 1;
		setBreakDuration(value);
		if (status === "idle" && mode === "break") {
			setTimeLeft(value * 60);
		}
	};

	const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
		e.target.select();
	};

	// --- RENDER (JSX) ---
	return (
		<div className="bg-slate-900 text-white min-h-screen flex flex-col items-center justify-center font-sans p-4">
			<style>{`
        input[type='number']::-webkit-inner-spin-button,
        input[type='number']::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type='number'] {
          -moz-appearance: textfield;
        }
      `}</style>
			<div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6">
				<header className="text-center">
					<h1 className="text-3xl md:text-4xl font-bold text-cyan-400">Foco Timer</h1>
					<p className="text-slate-400 mt-2">{headerMessage}</p>
				</header>

				<div className="flex items-center justify-center bg-slate-900/50 rounded-full w-64 h-64 md:w-72 md:h-72 mx-auto border-4 border-slate-700">
					<span className="text-6xl md:text-7xl font-mono tracking-tighter">{displayTime}</span>
				</div>

				<main>
					{status === "idle" && (
						<>
							{!completionMessage ? (
								<div className="space-y-4">
									<div>
										<label
											htmlFor="focus-duration"
											className="block text-center text-md font-medium text-slate-300 mb-3">
											Foco (min)
										</label>
										<input
											id="focus-duration"
											type="number"
											value={focusDuration}
											onChange={updateFocusDuration}
											onFocus={handleInputFocus}
											className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-center focus:ring-2 focus:ring-cyan-500 focus:outline-none"
										/>
									</div>
									<button
										onClick={startTimer}
										className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105">
										Iniciar Foco
									</button>
								</div>
							) : (
								<div className="text-center space-y-4">
									<p className="text-xl font-semibold text-green-400">{completionMessage}</p>
									{mode === "break" && (
										<div className="space-y-4">
											<div>
												<label
													htmlFor="break-duration"
													className="block text-sm font-medium text-slate-300 mb-1">
													Pausa (min)
												</label>
												<input
													id="break-duration"
													type="number"
													value={breakDuration}
													onChange={updateBreakDuration}
													onFocus={handleInputFocus}
													className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-center focus:ring-2 focus:ring-green-500 focus:outline-none"
												/>
											</div>
											<button
												onClick={startTimer}
												className="w-full bg-green-500 hover:bg-green-600 text-slate-900 font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105">
												Iniciar Pausa
											</button>
										</div>
									)}
									{mode === "focus" && completionMessage && (
										<button
											onClick={resetToStart}
											className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105">
											Nova Sessão de Foco
										</button>
									)}
								</div>
							)}
						</>
					)}

					{(status === "running" || status === "paused") && (
						<>
							{mode === "focus" ? (
								<div className="flex items-center justify-center space-x-4">
									<button
										onClick={togglePause}
										className="w-1/2 bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105">
										{status === "running" ? "Pausar" : "Continuar"}
									</button>
									<button
										onClick={resetTimer}
										className="w-1/2 bg-red-500 hover:bg-red-600 text-slate-900 font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105">
										Redefinir
									</button>
								</div>
							) : (
								// mode === 'break'
								<div className="flex items-center justify-center">
									<button
										onClick={resetToStart}
										className="w-full bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105">
										Pular Pausa
									</button>
								</div>
							)}
						</>
					)}
				</main>
			</div>
		</div>
	);
}

export default App;
