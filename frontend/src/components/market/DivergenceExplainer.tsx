"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Card, CardContent, Button, Spinner } from "@/components/ui";
import {
	explainDivergence,
	fetchMarketSentiment,
	type SentimentResponse,
} from "@/lib/api";
import styles from "./DivergenceExplainer.module.css";

interface DivergenceExplainerProps {
	marketId: string;
	divergence: number;
}

/**
 * AI-powered divergence explainer component.
 * Shows "🤖 Explain Divergence" button when divergence > 3%.
 * Rate limited to 1 call per minute per market (server-side).
 * Cached for 5 minutes (server-side).
 */
export function DivergenceExplainer({
	marketId,
	divergence,
}: DivergenceExplainerProps) {
	const [explanation, setExplanation] = useState<string | null>(null);
	const [sentiment, setSentiment] = useState<SentimentResponse | null>(null);
	const [mode, setMode] = useState<"divergence" | "sentiment">("divergence");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [wasCached, setWasCached] = useState(false);
	const [isHeadlinesExpanded, setIsHeadlinesExpanded] = useState(false);
	const [liveExplanation, setLiveExplanation] = useState("");
	const [isTypingExplanation, setIsTypingExplanation] = useState(false);
	const [explanationVersion, setExplanationVersion] = useState(0);

	const handleExplain = async () => {
		setMode("divergence");
		setIsLoading(true);
		setError(null);

		try {
			const result = await explainDivergence(marketId);
			setExplanation(result.explanation);
			setExplanationVersion((v) => v + 1);
			setWasCached(result.cached);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to get explanation";
			// Check for rate limit error
			if (errorMessage.includes("429") || errorMessage.includes("wait")) {
				setError("Please wait a moment before requesting another explanation.");
			} else {
				setError(errorMessage);
			}
		} finally {
			setIsLoading(false);
		}
	};

	const handleAnalyzeNews = async () => {
		setMode("sentiment");
		setIsLoading(true);
		setError(null);

		try {
			const result = await fetchMarketSentiment(marketId);
			setSentiment(result);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to analyze sentiment";
			if (errorMessage.includes("429") || errorMessage.includes("wait")) {
				setError("Please wait 30 seconds before requesting again.");
			} else {
				setError(errorMessage);
			}
		} finally {
			setIsLoading(false);
		}
	};

	const sentimentScore = sentiment?.avg_sentiment ?? 0;
	const sentimentIndicator =
		sentimentScore > 0.15 ? "▲" : sentimentScore < -0.15 ? "▼" : "●";
	const sentimentLabel =
		sentimentScore > 0.3
			? "VERY BULLISH"
			: sentimentScore > 0.15
				? "BULLISH"
				: sentimentScore < -0.3
					? "VERY BEARISH"
					: sentimentScore < -0.15
						? "BEARISH"
						: "NEUTRAL";
	useEffect(() => {
		if (!explanation) {
			setLiveExplanation("");
			setIsTypingExplanation(false);
			return;
		}

		setLiveExplanation("");
		setIsTypingExplanation(true);

		let timeoutId: ReturnType<typeof setTimeout> | undefined;
		let cursor = 0;
		const source = explanation;

		const writeNext = () => {
			cursor = Math.min(source.length, cursor + 2);
			setLiveExplanation(source.slice(0, cursor));
			if (cursor < source.length) {
				timeoutId = setTimeout(writeNext, 14);
				return;
			}
			setIsTypingExplanation(false);
		};

		timeoutId = setTimeout(writeNext, 120);

		return () => {
			if (timeoutId) clearTimeout(timeoutId);
		};
	}, [explanation, explanationVersion]);

	return (
		<Card
			className="overflow-hidden border-2 border-foreground bg-background"
			style={{ padding: 0 }}
		>
			<CardContent className="p-0">
				<div className={`flex items-stretch${isLoading || error || explanation || sentiment ? " border-b-2 border-foreground" : ""}`}>
					<div className="flex items-stretch border-r-[1px] border-foreground">
						<button
							type="button"
							onClick={() => {
								setError(null);
								setMode("divergence");
							}}
							className={`border px-3 py-1 text-xs uppercase tracking-[0.07em] transition-colors ${
								mode === "divergence"
									? "border-foreground bg-foreground text-background"
									: "border-foreground bg-background text-foreground hover:bg-foreground hover:text-background"
							}`}
						>
							AI Divergence Analysis
						</button>
						<button
							type="button"
							onClick={() => {
								setError(null);
								setMode("sentiment");
							}}
							className={`border-y border-r px-3 py-1 text-xs uppercase tracking-[0.07em] transition-colors ${
								mode === "sentiment"
									? "border-foreground bg-foreground text-background"
									: "border-foreground bg-background text-foreground hover:bg-foreground hover:text-background"
							}`}
						>
							Public Sentiment
						</button>
					</div>

					<div className="flex flex-1 items-center px-3">
						{mode === "divergence" && wasCached && explanation && (
							<span className="ml-2 text-xs uppercase tracking-[0.06em] text-muted">
								cached
							</span>
						)}
						{mode === "sentiment" && sentiment?.cached && (
							<span className="ml-2 text-xs uppercase tracking-[0.06em] text-muted">
								cached
							</span>
						)}
					</div>

					<div className="ml-auto flex items-center border-l-2 border-foreground">
						<Button
							onClick={mode === "sentiment" ? handleAnalyzeNews : handleExplain}
							variant="ghost"
							disabled={isLoading}
							className={`!flex !items-center !gap-2 !border-0 !bg-background !px-4 !py-2 text-xs uppercase tracking-[0.08em] text-foreground hover:!bg-foreground hover:!text-background sm:text-sm ${styles.explainButton}`}
						>
							{mode === "sentiment" ? (
								<span className={styles.snowflakeIcon} aria-hidden="true">
									<Image
										src="/logos/snowflake.png"
										alt=""
										width={14}
										height={14}
										className={styles.snowflakeLogo}
									/>
									<span className={styles.snowflakeGlow} />
								</span>
							) : (
								<span className={styles.geminiIcon} aria-hidden="true">
									<Image
										src="/logos/gemini.png"
										alt=""
										width={14}
										height={14}
										className={styles.geminiLogo}
									/>
									<span className={styles.geminiGlow} />
								</span>
							)}
							{isLoading
								? mode === "sentiment"
									? "Analyzing News..."
									: "Analyzing..."
								: mode === "sentiment"
									? "Analyze News"
									: explanation
										? "Refresh Explanation"
										: "Explain Divergence"}
						</Button>
					</div>
				</div>

				{isLoading && (
					<div className="flex items-center gap-2 px-3 py-3 text-muted">
						<Spinner size="sm" />
						<span className="text-sm">
							{mode === "sentiment"
								? "Fetching and analyzing public news sentiment..."
								: "Analyzing market with AI..."}
						</span>
					</div>
				)}

				{error && (
					<div className="m-3 rounded-md bg-danger/10 p-3 text-sm text-danger">
						{error}
					</div>
				)}

				{mode === "divergence" && explanation && (
					<div className="px-3 py-3">
						<p className="whitespace-pre-line text-sm leading-relaxed">
							{liveExplanation}
							<span
								aria-hidden="true"
								className={`${styles.liveCursor}${isTypingExplanation ? ` ${styles.liveCursorActive}` : ""}`}
							>
								|
							</span>
						</p>
					</div>
				)}

				{mode === "divergence" &&
					!explanation &&
					!isLoading &&
					Math.abs(divergence) <= 0.03 && (
						<div className="px-3 py-3 text-sm text-muted">
							Divergence is currently below the high-signal threshold.
						</div>
					)}

				{mode === "sentiment" && sentiment && (
					<div className="space-y-4 px-3 py-3">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-4">
								<span className="text-3xl font-bold">{sentimentIndicator}</span>
								<div>
									<div className="text-xl font-bold tracking-tight">
										{sentimentLabel}
									</div>
									<div className="font-mono text-xs text-muted">
										SCORE: {sentimentScore > 0 ? "+" : ""}
										{sentimentScore.toFixed(2)}
									</div>
								</div>
							</div>
							<div className="text-right">
								<div className="text-xs uppercase tracking-[0.06em] text-muted">
									Topic
								</div>
								<div className="font-mono text-sm">{sentiment.topic}</div>
							</div>
						</div>

						<div className="border-2 border-foreground p-3">
							<p className="text-sm leading-relaxed">{sentiment.insight}</p>
						</div>

						{sentiment.headlines.length > 0 && (
							<div className="space-y-2">
								<button
									type="button"
									onClick={() => setIsHeadlinesExpanded((v) => !v)}
									className="flex w-full items-center justify-between border-2 border-foreground bg-background px-3 py-2 text-left text-xs uppercase tracking-[0.07em] hover:bg-foreground hover:text-background"
								>
									<span>{sentiment.headlines.length} Headlines Analyzed</span>
									<span className="text-base">
										{isHeadlinesExpanded ? "−" : "+"}
									</span>
								</button>
								{isHeadlinesExpanded && (
									<div className="max-h-56 overflow-auto border-2 border-foreground">
										{sentiment.headlines.map((headline, idx) => (
											<div
												key={`${headline.text}-${idx}`}
												className="border-t border-foreground/20 px-3 py-2 first:border-t-0"
											>
												<div className="flex items-start gap-2">
													<span className="mt-0.5 text-xs">
														{headline.sentiment > 0.15
															? "▲"
															: headline.sentiment < -0.15
																? "▼"
																: "●"}
													</span>
													<div className="min-w-0 flex-1">
														{headline.link ? (
															<a
																href={headline.link}
																target="_blank"
																rel="noopener noreferrer"
																className="text-sm underline underline-offset-2 hover:bg-foreground hover:text-background hover:no-underline"
															>
																{headline.text}
															</a>
														) : (
															<p className="text-sm">{headline.text}</p>
														)}
														<div className="mt-1 font-mono text-[11px] text-muted">
															{headline.sentiment > 0 ? "+" : ""}
															{headline.sentiment.toFixed(2)}
															{headline.published
																? ` · ${headline.published}`
																: ""}
														</div>
													</div>
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
