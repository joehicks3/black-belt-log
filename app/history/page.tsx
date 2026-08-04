import Link from "next/link";
import { redirect } from "next/navigation";
import DeleteEntryButton from "@/components/DeleteEntryButton";
import { createClient } from "@/lib/supabase/server";

type HistoryPageProps = {
  searchParams: Promise<{
    exercise?: string;
    start?: string;
    end?: string;
    page?: string;
  }>;
};

type Exercise = {
  id: string;
  name: string;
  unit_name: string;
  exercise_categories: {
    name: string;
  }[];
};

type ExerciseEntry = {
  id: string;
  exercise_id: string;
  quantity: number;
  completed_at: string;
  notes: string;
};

const PAGE_SIZE = 25;

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

function getPageNumber(value: string | undefined) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function buildHistoryUrl({
  exercise,
  start,
  end,
  page,
}: {
  exercise?: string;
  start?: string;
  end?: string;
  page: number;
}) {
  const params = new URLSearchParams();

  if (exercise) {
    params.set("exercise", exercise);
  }

  if (start) {
    params.set("start", start);
  }

  if (end) {
    params.set("end", end);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();

  return queryString ? `/history?${queryString}` : "/history";
}

export default async function HistoryPage({
  searchParams,
}: HistoryPageProps) {
  const filters = await searchParams;

  const selectedExercise = filters.exercise ?? "";
  const startDate = filters.start ?? "";
  const endDate = filters.end ?? "";
  const currentPage = getPageNumber(filters.page);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: exerciseData, error: exerciseError } = await supabase
  .from("exercises")
  .select(`
    id,
    name,
    unit_name,
    exercise_categories (
      name
    )
  `)
  .eq("is_active", true)
  .order("display_order", { ascending: true });

  if (exerciseError) {
    throw new Error(
      `Unable to load exercises: ${exerciseError.message}`,
    );
  }

  const exercises = (exerciseData ?? []) as Exercise[];

  const firstRow = (currentPage - 1) * PAGE_SIZE;
  const lastRow = firstRow + PAGE_SIZE - 1;

  let entriesQuery = supabase
    .from("exercise_entries")
    .select("id, exercise_id, quantity, completed_at, notes", {
      count: "exact",
    })
    .eq("user_id", user.id)
    .order("completed_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (selectedExercise) {
    entriesQuery = entriesQuery.eq(
      "exercise_id",
      selectedExercise,
    );
  }

  if (startDate) {
    entriesQuery = entriesQuery.gte(
      "completed_at",
      `${startDate}T00:00:00.000Z`,
    );
  }

  if (endDate) {
    entriesQuery = entriesQuery.lte(
      "completed_at",
      `${endDate}T23:59:59.999Z`,
    );
  }

  const {
    data: entryData,
    error: entryError,
    count,
  } = await entriesQuery.range(firstRow, lastRow);

  if (entryError) {
    throw new Error(
      `Unable to load activity history: ${entryError.message}`,
    );
  }

  const entries = (entryData ?? []) as ExerciseEntry[];

  const exerciseById = new Map(
    exercises.map((exercise) => [exercise.id, exercise]),
  );

  const totalEntries = count ?? 0;
  const totalPages = Math.max(
    1,
    Math.ceil(totalEntries / PAGE_SIZE),
  );

  /*
   * Redirect if a user requests a page number beyond the final page.
   * This can happen after filtering or deleting the only entry on a page.
   */
  if (currentPage > totalPages) {
    redirect(
      buildHistoryUrl({
        exercise: selectedExercise,
        start: startDate,
        end: endDate,
        page: totalPages,
      }),
    );
  }

  const quantityOnPage = entries.reduce(
    (total, entry) => total + entry.quantity,
    0,
  );

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-5xl">
        <header>
          <Link
            href="/"
            className="text-sm font-medium text-emerald-400 transition hover:text-emerald-300"
          >
            ← Back to dashboard
          </Link>

          <h1 className="mt-5 text-3xl font-bold tracking-tight">
            Activity History
          </h1>

          <p className="mt-2 text-zinc-400">
            Review and manage previously recorded training.
          </p>
        </header>

        <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <form
            method="get"
            className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto_auto] md:items-end"
          >
            <div>
              <label
                htmlFor="exercise"
                className="block text-sm font-medium text-zinc-300"
              >
                Exercise
              </label>

              <select
                id="exercise"
                name="exercise"
                defaultValue={selectedExercise}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">All exercises</option>

                {exercises.map((exercise) => {
                const categoryName =
                    exercise.exercise_categories[0]?.name;

                return (
                    <option key={exercise.id} value={exercise.id}>
                    {categoryName
                        ? `${categoryName} — ${exercise.name}`
                        : exercise.name}
                    </option>
                );
                })}
              </select>
            </div>

            <div>
              <label
                htmlFor="start"
                className="block text-sm font-medium text-zinc-300"
              >
                Start date
              </label>

              <input
                id="start"
                name="start"
                type="date"
                defaultValue={startDate}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label
                htmlFor="end"
                className="block text-sm font-medium text-zinc-300"
              >
                End date
              </label>

              <input
                id="end"
                name="end"
                type="date"
                defaultValue={endDate}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-5 py-2.5 font-semibold text-zinc-950 transition hover:bg-emerald-400"
            >
              Filter
            </button>

            <Link
              href="/history"
              className="rounded-lg border border-zinc-700 px-5 py-2.5 text-center font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              Clear
            </Link>
          </form>
        </section>

        <section className="mt-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 p-5">
            <div>
              <h2 className="text-xl font-semibold">
                Recorded activity
              </h2>

              <p className="mt-1 text-sm text-zinc-400">
                {totalEntries.toLocaleString()}{" "}
                {totalEntries === 1 ? "entry" : "entries"} found
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Quantity on this page
              </p>

              <p className="mt-1 text-xl font-semibold text-emerald-400">
                {quantityOnPage.toLocaleString()}
              </p>
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-medium text-zinc-200">
                No matching activity
              </p>

              <p className="mt-2 text-sm text-zinc-400">
                Adjust the filters or add activity from the
                dashboard.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {entries.map((entry) => {
                const exercise = exerciseById.get(entry.exercise_id);
                const categoryName = exercise?.exercise_categories[0]?.name;

                return (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                        <p className="font-medium text-zinc-100">
                        {exercise
                            ? categoryName
                            ? `${categoryName} — ${exercise.name}`
                            : exercise.name
                            : "Unknown exercise"}
                        </p>

                      <p className="mt-1 text-sm text-zinc-400">
                        {formatEntryDate(entry.completed_at)}
                      </p>

                      {entry.notes && <p className="mt-1 text-sm text-zinc-400">{entry.notes}</p>}
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <p className="font-semibold text-emerald-400">
                        +{entry.quantity.toLocaleString()}{" "}
                        {exercise?.unit_name ?? ""}
                      </p>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/entries/${entry.id}/edit`}
                          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
                        >
                          Edit
                        </Link>

                        <DeleteEntryButton entryId={entry.id} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-800 p-5">
              <div className="text-sm text-zinc-400">
                Page {currentPage} of {totalPages}
              </div>

              <div className="flex gap-2">
                {currentPage > 1 ? (
                  <Link
                    href={buildHistoryUrl({
                      exercise: selectedExercise,
                      start: startDate,
                      end: endDate,
                      page: currentPage - 1,
                    })}
                    className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="cursor-not-allowed rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-600">
                    Previous
                  </span>
                )}

                {currentPage < totalPages ? (
                  <Link
                    href={buildHistoryUrl({
                      exercise: selectedExercise,
                      start: startDate,
                      end: endDate,
                      page: currentPage + 1,
                    })}
                    className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
                  >
                    Next
                  </Link>
                ) : (
                  <span className="cursor-not-allowed rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-600">
                    Next
                  </span>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}