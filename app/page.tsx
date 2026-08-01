import Link from "next/link";
import { redirect } from "next/navigation";

import { addExerciseEntry } from "@/app/actions";
import DeleteEntryButton from "@/components/DeleteEntryButton";
import ExerciseCategoryTabs, {
  type ExerciseCategory,
} from "@/components/ExerciseCategoryTabs";
import { createClient } from "@/lib/supabase/server";

const TRAINING_START_DATE = new Date("2026-07-23T00:00:00");
const TRAINING_DEADLINE = new Date("2026-10-24T23:59:59");

type HomePageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

type ExerciseCategoryRecord = {
  id: number;
  name: string;
  display_order: number;
};

type Exercise = {
  id: string;
  name: string;
  target_quantity: number;
  unit_name: string;
  display_order: number;
  category_id: number;
};

type ExerciseEntry = {
  id: string;
  exercise_id: string;
  quantity: number;
  completed_at: string;
  created_at: string;
};

function getStartOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
}

function getInclusiveDayCount(
  startDate: Date,
  endDate: Date,
): number {
  const millisecondsPerDay =
    1000 * 60 * 60 * 24;

  const start = getStartOfDay(startDate);
  const end = getStartOfDay(endDate);

  const difference =
    end.getTime() - start.getTime();

  return Math.floor(
    difference / millisecondsPerDay,
  ) + 1;
}

function formatEntryDate(dateValue: string | null): string {
  if (!dateValue) {
    return "Unknown date";
  }

  const [year, month, day] = dateValue
    .split("-")
    .map(Number);

  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getTodayInputValue(): string {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(
    today.getMonth() + 1,
  ).padStart(2, "0");
  const day = String(
    today.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default async function Home({
  searchParams,
}: HomePageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;

  const [
    {
      data: exerciseData,
      error: exerciseError,
    },
    {
      data: categoryData,
      error: categoryError,
    },
    {
      data: entryData,
      error: entryError,
    },
  ] = await Promise.all([
    supabase
      .from("exercises")
      .select(`
        id,
        name,
        target_quantity,
        unit_name,
        display_order,
        category_id
      `)
      .eq("is_active", true)
      .order("display_order", {
        ascending: true,
      }),

    supabase
      .from("exercise_categories")
      .select(`
        id,
        name,
        display_order
      `)
      .eq("is_active", true)
      .order("display_order", {
        ascending: true,
      }),

    supabase
      .from("exercise_entries")
      .select(`
        id,
        exercise_id,
        quantity,
        completed_at,
        created_at
      `)
      .eq("user_id", user.id)
      .order("completed_at", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      }),
  ]);

  if (exerciseError) {
    console.error(
      "Unable to load exercises:",
      exerciseError,
    );

    throw new Error(
      `Unable to load exercises: ${exerciseError.message}`,
    );
  }

  if (categoryError) {
    console.error(
      "Unable to load exercise categories:",
      categoryError,
    );

    throw new Error(
      `Unable to load exercise categories: ${categoryError.message}`,
    );
  }

  if (entryError) {
    console.error(
      "Unable to load exercise entries:",
      entryError,
    );

    throw new Error(
      `Unable to load exercise entries: ${entryError.message}`,
    );
  }

  const exercises =
    (exerciseData ?? []) as Exercise[];

  const categoryRecords =
    (categoryData ??
      []) as ExerciseCategoryRecord[];

  const entries =
    (entryData ?? []) as ExerciseEntry[];

  const categoryById = new Map<
    number,
    ExerciseCategoryRecord
  >(
    categoryRecords.map((category) => [
      category.id,
      category,
    ]),
  );

  const sortedExercises = [...exercises].sort(
  (first, second) => {
    const firstCategory =
      categoryById.get(first.category_id);

    const secondCategory =
      categoryById.get(second.category_id);

    const categoryOrderDifference =
      (firstCategory?.display_order ?? 9999) -
      (secondCategory?.display_order ?? 9999);

    if (categoryOrderDifference !== 0) {
      return categoryOrderDifference;
    }

    const exerciseOrderDifference =
      first.display_order -
      second.display_order;

    if (exerciseOrderDifference !== 0) {
      return exerciseOrderDifference;
    }

    return first.name.localeCompare(second.name);
  },
);

  const exerciseById = new Map<
    string,
    Exercise
  >(
    exercises.map((exercise) => [
      exercise.id,
      exercise,
    ]),
  );

  const completedByExercise = new Map<
    string,
    number
  >();

  for (const entry of entries) {
    const currentQuantity =
      completedByExercise.get(
        entry.exercise_id,
      ) ?? 0;

    completedByExercise.set(
      entry.exercise_id,
      currentQuantity + entry.quantity,
    );
  }

  const today = new Date();

  const effectiveProgressDate =
    today < TRAINING_START_DATE
      ? TRAINING_START_DATE
      : today > TRAINING_DEADLINE
        ? TRAINING_DEADLINE
        : today;

  const daysSinceTrainingStarted =
    Math.max(
      1,
      getInclusiveDayCount(
        TRAINING_START_DATE,
        effectiveProgressDate,
      ),
    );

  const daysRemaining =
    today > TRAINING_DEADLINE
      ? 0
      : Math.max(
          1,
          getInclusiveDayCount(
            today < TRAINING_START_DATE
              ? TRAINING_START_DATE
              : today,
            TRAINING_DEADLINE,
          ),
        );

  const categoriesById = new Map<
    number,
    ExerciseCategory
  >();

  for (const exercise of exercises) {
    const category = categoryById.get(
      exercise.category_id,
    );

    if (!category) {
      console.warn(
        `Exercise ${exercise.id} references unavailable category ${exercise.category_id}`,
      );

      continue;
    }

    const completed =
      completedByExercise.get(
        exercise.id,
      ) ?? 0;

    const remaining = Math.max(
      0,
      exercise.target_quantity -
        completed,
    );

    const progressPercentage =
      exercise.target_quantity > 0
        ? Math.min(
            100,
            Math.round(
              (completed /
                exercise.target_quantity) *
                100,
            ),
          )
        : 0;

    const averagePerDay =
      completed /
      daysSinceTrainingStarted;

    const requiredPerDay =
      remaining === 0
        ? 0
        : daysRemaining > 0
          ? remaining /
            daysRemaining
          : null;

    let categoryGroup =
      categoriesById.get(category.id);

    if (!categoryGroup) {
      categoryGroup = {
        id: category.id,
        name: category.name,
        displayOrder:
          category.display_order,
        exercises: [],
      };

      categoriesById.set(
        category.id,
        categoryGroup,
      );
    }

    categoryGroup.exercises.push({
      id: exercise.id,
      name: exercise.name,
      targetQuantity:
        exercise.target_quantity,
      unitName: exercise.unit_name,
      completed,
      remaining,
      progressPercentage,
      averagePerDay,
      requiredPerDay,
    });
  }

  const categorizedExercises =
    Array.from(
      categoriesById.values(),
    ).sort(
      (first, second) =>
        first.displayOrder -
        second.displayOrder,
    );

  const recentEntries = entries.slice(
    0,
    10,
  );

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
                Black Belt Training
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Training Dashboard
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                Track cumulative training
                progress through October 24,
                2026.
              </p>
            </div>

            <Link
              href="/history"
              className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
            >
              View activity history
            </Link>
          </div>
        </header>

        {resolvedSearchParams.error ? (
          <div className="mb-6 rounded-xl border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {resolvedSearchParams.error}
          </div>
        ) : null}

        {resolvedSearchParams.success ? (
          <div className="mb-6 rounded-xl border border-emerald-900/70 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
            {resolvedSearchParams.success}
          </div>
        ) : null}

        <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">
              Log training
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              Add completed exercises or
              skills to the training history.
            </p>
          </div>

          {exercises.length === 0 ? (
            <p className="rounded-lg bg-zinc-800 p-4 text-sm text-zinc-400">
              No active exercises are
              available.
            </p>
          ) : (
        <form
          action={addExerciseEntry}
          className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
        >
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-300">
              Exercise or skill
            </span>

            <select
              name="exercise_id"
              required
              defaultValue=""
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="" disabled>
                Select an exercise
              </option>

              {sortedExercises.map((exercise) => {
                const categoryName =
                  categoryById.get(
                    exercise.category_id,
                  )?.name;

                return (
                  <option
                    key={exercise.id}
                    value={exercise.id}
                  >
                    {categoryName
                      ? `${categoryName} — ${exercise.name}`
                      : exercise.name}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-300">
              Quantity
            </span>

            <input
              type="number"
              name="quantity"
              min="1"
              step="1"
              required
              placeholder="0"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-300">
              Date completed
            </span>

            <input
              type="date"
              name="completed_at"
              required
              defaultValue={getTodayInputValue()}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>

          <button
            type="submit"
            className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-zinc-900"
          >
            Add entry
          </button>
        </form>
          )}
        </section>

        <section className="mb-8">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">
              Progress
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              Select a category to view its
              exercises and skills.
            </p>
          </div>

          <ExerciseCategoryTabs
            categories={
              categorizedExercises
            }
          />
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">
                Recent activity
              </h2>

              <p className="mt-1 text-sm text-zinc-400">
                The ten most recent training
                entries.
              </p>
            </div>

            <Link
              href="/history"
              className="shrink-0 text-sm font-semibold text-emerald-400 transition hover:text-emerald-300"
            >
              View all →
            </Link>
          </div>

          {recentEntries.length === 0 ? (
            <p className="rounded-lg bg-zinc-800 p-4 text-sm text-zinc-400">
              No training activity has been
              logged yet.
            </p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {recentEntries.map(
                (entry) => {
                  const exercise =
                    exerciseById.get(
                      entry.exercise_id,
                    );

                  const categoryName =
                    exercise
                      ? categoryById.get(
                          exercise.category_id,
                        )?.name
                      : undefined;

                  const exerciseLabel =
                    exercise
                      ? categoryName
                        ? `${categoryName} — ${exercise.name}`
                        : exercise.name
                      : "Unknown exercise";

                  return (
                    <div
                      key={entry.id}
                      className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-zinc-100">
                          {exerciseLabel}
                        </p>

                        <p className="mt-1 text-sm text-zinc-400">
                          {entry.quantity.toLocaleString()}{" "}
                          {exercise?.unit_name ??
                            "completed"}{" "}
                          on{" "}
                          {formatEntryDate(
                            entry.completed_at,
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/entries/${entry.id}/edit`}
                          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
                        >
                          Edit
                        </Link>

                        <DeleteEntryButton
                          entryId={entry.id}
                        />
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}