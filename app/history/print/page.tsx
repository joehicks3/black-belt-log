import Link from "next/link";
import { redirect } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { createClient } from "@/lib/supabase/server";

type PrintHistoryPageProps = {
  searchParams: Promise<{
    exercise?: string;
    start?: string;
    end?: string;
  }>;
};

type Exercise = {
  id: string;
  name: string;
  unit_name: string;
  exercise_category: {
    name: string;
  } | { name: string }[] | null;
};

type ExerciseEntry = {
  id: string;
  exercise_id: string;
  quantity: number;
  completed_at: string;
  notes: string;
};

type EntryDay = {
  dateKey: string;
  entries: ExerciseEntry[];
};

const FETCH_BATCH_SIZE = 500;

function getExerciseCategory(exercise: Exercise | undefined): string | undefined {
  const category = exercise?.exercise_category;
  return Array.isArray(category) ? category[0]?.name : category?.name;
}

function formatEntryDate(dateValue: string): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default async function PrintHistoryPage({
  searchParams,
}: PrintHistoryPageProps) {
  const filters = await searchParams;
  const selectedExercise = filters.exercise ?? "";
  const startDate = filters.start ?? "";
  const endDate = filters.end ?? "";
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
      exercise_category:exercise_categories (
        name
      )
    `)
    .order("display_order", { ascending: true });

  if (exerciseError) {
    throw new Error(`Unable to load exercises: ${exerciseError.message}`);
  }

  const exercises = (exerciseData ?? []) as Exercise[];
  const entries: ExerciseEntry[] = [];

  for (let offset = 0; ; offset += FETCH_BATCH_SIZE) {
    let entriesQuery = supabase
      .from("exercise_entries")
      .select("id, exercise_id, quantity, completed_at, notes")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: true })
      .order("created_at", { ascending: true });

    if (selectedExercise) {
      entriesQuery = entriesQuery.eq("exercise_id", selectedExercise);
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

    const { data, error } = await entriesQuery.range(
      offset,
      offset + FETCH_BATCH_SIZE - 1,
    );

    if (error) {
      throw new Error(`Unable to load activity history: ${error.message}`);
    }

    const batch = (data ?? []) as ExerciseEntry[];
    entries.push(...batch);

    if (batch.length < FETCH_BATCH_SIZE) {
      break;
    }
  }

  const exerciseById = new Map(
    exercises.map((exercise) => [exercise.id, exercise]),
  );
  const daysByKey = new Map<string, EntryDay>();

  for (const entry of entries) {
    const dateKey = entry.completed_at?.split("T")[0] ?? "unknown";
    const day = daysByKey.get(dateKey) ?? { dateKey, entries: [] };
    day.entries.push(entry);
    daysByKey.set(dateKey, day);
  }

  const days = Array.from(daysByKey.values());
  const totalQuantity = entries.reduce(
    (total, entry) => total + entry.quantity,
    0,
  );
  const totalsByExercise = new Map<string, { quantity: number; count: number }>();

  for (const entry of entries) {
    const total = totalsByExercise.get(entry.exercise_id) ?? { quantity: 0, count: 0 };
    total.quantity += entry.quantity;
    total.count += 1;
    totalsByExercise.set(entry.exercise_id, total);
  }

  const exerciseSummary = Array.from(totalsByExercise, ([id, total]) => {
    const exercise = exerciseById.get(id);
    return {
      id,
      name: exercise?.name ?? "Unknown exercise",
      category: getExerciseCategory(exercise) ?? "Uncategorized",
      unit: exercise?.unit_name ?? "",
      ...total,
    };
  }).sort((a, b) =>
    a.category.localeCompare(b.category) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );

  const historyParams = new URLSearchParams();

  if (selectedExercise) {
    historyParams.set("exercise", selectedExercise);
  }

  if (startDate) {
    historyParams.set("start", startDate);
  }

  if (endDate) {
    historyParams.set("end", endDate);
  }

  const historyUrl = historyParams.size
    ? `/history?${historyParams.toString()}`
    : "/history";

  return (
    <main className="print-history min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <div className="no-print flex items-center justify-between gap-4">
            <Link
              href={historyUrl}
              className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
            >
              Back to history
            </Link>
            <PrintButton />
          </div>

          <h1 className="mt-5 text-3xl font-bold tracking-tight">
            Training History
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {entries.length.toLocaleString()} {entries.length === 1 ? "entry" : "entries"}
            {days.length > 0
              ? ` across ${days.length} ${days.length === 1 ? "day" : "days"}`
              : ""}
            {` · ${totalQuantity.toLocaleString()} total quantity`}
          </p>
          {(selectedExercise || startDate || endDate) && (
            <p className="mt-2 text-sm text-zinc-400">
              Filters: {[
                selectedExercise
                  ? exerciseById.get(selectedExercise)?.name ?? "Selected exercise"
                  : null,
                startDate ? `from ${startDate}` : null,
                endDate ? `through ${endDate}` : null,
              ].filter(Boolean).join(" · ")}
            </p>
          )}
        </header>

        {days.length === 0 ? (
          <p className="border-t border-zinc-700 py-6 text-zinc-400">
            No matching activity.
          </p>
        ) : (
          <div>
            {days.map((day) => {
              const dayQuantity = day.entries.reduce(
                (total, entry) => total + entry.quantity,
                0,
              );

              return (
                <section key={day.dateKey} className="history-day mb-8">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-700 pb-2">
                    <h2 className="text-xl font-semibold">
                      {day.dateKey === "unknown"
                        ? "Unknown date"
                        : formatEntryDate(day.dateKey)}
                    </h2>
                    <p className="text-sm text-zinc-400">
                      {day.entries.length} {day.entries.length === 1 ? "entry" : "entries"}
                      {` · ${dayQuantity.toLocaleString()} quantity`}
                    </p>
                  </div>

                  <div>
                    {day.entries.map((entry) => {
                      const exercise = exerciseById.get(entry.exercise_id);
                      const categoryName = getExerciseCategory(exercise);

                      return (
                        <article
                          key={entry.id}
                          className="history-entry flex flex-col justify-between gap-2 border-b border-zinc-800 py-3 sm:flex-row sm:items-start"
                        >
                          <div>
                            <h3 className="font-medium">
                              {exercise
                                ? categoryName
                                  ? `${categoryName} — ${exercise.name}`
                                  : exercise.name
                                : "Unknown exercise"}
                            </h3>
                            {entry.notes && (
                              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-400">
                                {entry.notes}
                              </p>
                            )}
                          </div>
                          <p className="shrink-0 font-semibold text-emerald-400">
                            +{entry.quantity.toLocaleString()} {exercise?.unit_name ?? ""}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
        {exerciseSummary.length > 0 && (
          <section className="history-summary mt-8" aria-labelledby="exercise-summary-title">
            <h2 id="exercise-summary-title" className="mb-3 text-xl font-semibold">
              Exercise totals
            </h2>
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th scope="col" className="py-2 pr-3">Exercise category</th>
                  <th scope="col" className="py-2 pr-3">Exercise</th>
                  <th scope="col" className="px-3 py-2 text-right">Entries</th>
                  <th scope="col" className="py-2 pl-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {exerciseSummary.map((exercise) => (
                  <tr key={exercise.id}>
                    <td className="py-1 pr-3 align-top">{exercise.category}</td>
                    <th scope="row" className="py-1 pr-3 align-top font-normal">{exercise.name}</th>
                    <td className="px-3 py-1 text-right align-top">{exercise.count.toLocaleString()}</td>
                    <td className="py-1 pl-3 text-right align-top">
                      {exercise.quantity.toLocaleString()} {exercise.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </main>
  );
}