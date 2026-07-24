"use client";

import { useState } from "react";

export type ExerciseProgress = {
  id: string;
  name: string;
  targetQuantity: number;
  unitName: string;
  completed: number;
  remaining: number;
  progressPercentage: number;
  averagePerDay: number;
  requiredPerDay: number | null;
};

export type ExerciseCategory = {
  id: number;
  name: string;
  displayOrder: number;
  exercises: ExerciseProgress[];
};

type ExerciseCategoryTabsProps = {
  categories: ExerciseCategory[];
};

export default function ExerciseCategoryTabs({
  categories,
}: ExerciseCategoryTabsProps) {
  const firstCategoryId = categories[0]?.id ?? null;

  const [selectedCategoryId, setSelectedCategoryId] = useState<
    number | null
  >(firstCategoryId);

  if (categories.length === 0) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">
          No exercises found
        </h2>

        <p className="mt-2 text-sm text-zinc-400">
          Add active exercises and categories in Supabase to display
          them here.
        </p>
      </section>
    );
  }

  const selectedCategory =
    categories.find(
      (category) => category.id === selectedCategoryId,
    ) ?? categories[0];

  return (
    <section>
      <div
        role="tablist"
        aria-label="Exercise categories"
        className="mb-5 flex gap-2 overflow-x-auto border-b border-zinc-800 pb-3"
      >
        {categories.map((category) => {
          const isSelected =
            category.id === selectedCategory.id;

          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() =>
                setSelectedCategoryId(category.id)
              }
              className={
                isSelected
                  ? "shrink-0 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950"
                  : "shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
              }
            >
              {category.name}

              <span
                className={
                  isSelected
                    ? "ml-2 text-zinc-800"
                    : "ml-2 text-zinc-500"
                }
              >
                {category.exercises.length}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        className="grid gap-5 md:grid-cols-2"
      >
        {selectedCategory.exercises.map((exercise) => (
          <article
            key={exercise.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-100">
                  {exercise.name}
                </h2>

                <p className="mt-1 text-sm text-zinc-400">
                  Goal:{" "}
                  {exercise.targetQuantity.toLocaleString()}{" "}
                  {exercise.unitName}
                </p>
              </div>

              <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm font-medium text-zinc-200">
                {exercise.progressPercentage}%
              </span>
            </div>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{
                  width: `${exercise.progressPercentage}%`,
                }}
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-zinc-800 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Completed
                </p>

                <p className="mt-1 text-xl font-semibold text-zinc-100">
                  {exercise.completed.toLocaleString()}
                </p>
              </div>

              <div className="rounded-lg bg-zinc-800 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Remaining
                </p>

                <p className="mt-1 text-xl font-semibold text-zinc-100">
                  {exercise.remaining.toLocaleString()}
                </p>
              </div>

              <div className="rounded-lg bg-zinc-800 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Average per day
                </p>

                <p className="mt-1 text-xl font-semibold text-zinc-100">
                  {exercise.averagePerDay.toFixed(1)}
                </p>
              </div>

              <div className="rounded-lg bg-zinc-800 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Required per day
                </p>

                <p className="mt-1 text-xl font-semibold text-zinc-100">
                  {exercise.requiredPerDay === null
                    ? "Deadline passed"
                    : exercise.requiredPerDay.toFixed(1)}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}