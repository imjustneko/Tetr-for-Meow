'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { getLessonById } from '@/lib/training/lessons';
import { TrainingEngine, TrainingState } from '@/lib/training/trainingEngine';
import { TrainingCanvas } from '@/components/training/TrainingCanvas';
import { TrainingHUD } from '@/components/training/TrainingHUD';
import { HoldBox } from '@/components/game/HoldBox';
import { NextQueue } from '@/components/game/NextQueue';
import { Button } from '@/components/ui/Button';
import { useTrainingInput } from '@/hooks/useTrainingInput';
import api from '@/lib/api';

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const lessonId = params.lessonId as string;
  const lesson = getLessonById(lessonId);

  const engineRef = useRef<TrainingEngine | null>(null);
  const [trainingState, setTrainingState] = useState<TrainingState | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [showHologram, setShowHologram] = useState(true);
  const [attempts, setAttempts] = useState(0);

  useTrainingInput(engineRef, isActive);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  const startLesson = useCallback(() => {
    if (!lesson) return;
    if (engineRef.current) engineRef.current.stop();

    const engine = new TrainingEngine(lesson);
    engineRef.current = engine;
    engine.setShowHologram(showHologram);

    engine.onStateChange = (state) => {
      setTrainingState(state);
      if (state.lessonComplete && user) {
        api
          .post('/api/training/progress', {
            lessonId: lesson.id,
            completed: true,
            attempts: attempts + 1,
          })
          .catch(() => undefined);
      }
    };

    engine.onStepComplete = () => {};
    engine.start();
    setIsActive(true);
    setAttempts((a) => a + 1);
  }, [lesson, showHologram, user, attempts]);

  const handleRetry = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.restart();
      setAttempts((a) => a + 1);
      return;
    }
    startLesson();
  }, [startLesson]);

  useEffect(() => {
    return () => engineRef.current?.stop();
  }, []);

  if (!lesson) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] text-white">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">Lesson not found</h1>
          <Link href="/train">
            <Button variant="secondary">Back to Academy</Button>
          </Link>
        </div>
      </div>
    );
  }

  const currentStep = trainingState ? lesson.steps[trainingState.currentStep] ?? null : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0f] text-white">
      <div className="flex items-center justify-between border-b border-[#2a2a3a] bg-[#0d0d1a] px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/train" className="text-sm text-gray-500 transition-colors hover:text-white">
            ← Academy
          </Link>
          <span className="text-gray-600">|</span>
          <span className="font-bold text-white">{lesson.title}</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
              lesson.difficulty === 'beginner'
                ? 'border-green-500/30 bg-green-500/10 text-green-400'
                : lesson.difficulty === 'intermediate'
                  ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
                  : 'border-red-500/30 bg-red-500/10 text-red-400'
            }`}
          >
            {lesson.difficulty}
          </span>
        </div>
        <div className="text-sm text-gray-500">Attempts: {attempts}</div>
      </div>

      <div className="flex flex-1 items-start justify-center gap-6 p-6 pt-8">
        {!isActive ? (
          <div className="max-w-lg text-center">
            <div className="mb-4 text-5xl">
              {lesson.category === 'spins'
                ? '🌀'
                : lesson.category === 'openers'
                  ? '🚀'
                  : lesson.category === 'combos'
                    ? '🔥'
                    : '🛡️'}
            </div>
            <h1 className="mb-3 text-3xl font-black">{lesson.title}</h1>
            <p className="mb-8 leading-relaxed text-gray-400">{lesson.description}</p>

            <div className="mb-8 rounded-2xl border border-[#2a2a3a] bg-[#12121a] p-6 text-left">
              <h3 className="mb-3 font-bold text-white">What you&apos;ll do:</h3>
              {lesson.steps.map((step, i) => (
                <div key={i} className="mb-2 flex items-start gap-3">
                  <span className="mt-0.5 font-mono text-sm text-cyan-400">{i + 1}.</span>
                  <p className="text-sm text-gray-300">{step.tip}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-3">
              <Button variant="primary" size="lg" onClick={startLesson}>
                Start Lesson
              </Button>
              <Link href="/train">
                <Button variant="secondary" size="lg">
                  Back
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 pt-2">
              {trainingState ? (
                <HoldBox heldPiece={trainingState.gameState.heldPiece} canHold={trainingState.gameState.canHold} />
              ) : null}
            </div>

            <div className="relative flex flex-col items-center gap-3">
              {trainingState ? (
                <TrainingCanvas gameState={trainingState.gameState} hologram={trainingState?.hologram ?? null} />
              ) : null}

              {trainingState?.lessonComplete ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
                  <div className="mx-4 max-w-sm rounded-2xl border border-green-500/40 bg-[#12121a] p-8 text-center">
                    <div className="mb-3 text-5xl">🎓</div>
                    <h2 className="mb-2 text-2xl font-black text-green-400">Lesson Complete!</h2>
                    <p className="mb-6 text-gray-400">You mastered {lesson.title}</p>
                    <div className="flex justify-center gap-3">
                      <Button variant="primary" onClick={handleRetry}>
                        Practice Again
                      </Button>
                      <Link href="/train">
                        <Button variant="secondary">Academy</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="text-center text-xs text-gray-600">
                <kbd className="rounded bg-gray-800 px-1">Space</kbd> hard drop ·{' '}
                <kbd className="rounded bg-gray-800 px-1">↑</kbd> rotate ·{' '}
                <kbd className="rounded bg-gray-800 px-1">C</kbd> hold
              </div>
            </div>

            <div className="flex flex-col gap-4 pt-2">
              {trainingState ? <NextQueue queue={trainingState.gameState.nextQueue} /> : null}
              <TrainingHUD
                step={currentStep}
                currentStepIndex={trainingState?.currentStep ?? 0}
                totalSteps={lesson.steps.length}
                stepResult={trainingState?.stepResult ?? 'pending'}
                feedbackMessage={trainingState?.feedbackMessage ?? ''}
                onRetry={handleRetry}
                onToggleHologram={() => {
                  setShowHologram((prev) => {
                    const next = !prev;
                    engineRef.current?.setShowHologram(next);
                    return next;
                  });
                }}
                showHologram={showHologram}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
