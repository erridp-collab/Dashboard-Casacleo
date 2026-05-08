import { AlertTriangle, CheckCircle2, Clock3, RefreshCcw, XCircle } from "lucide-react";
import { Card, CardHeader } from "@/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/table";
import {
  approveSignupRequestAction,
  rejectSignupRequestAction,
} from "@/app/platform/actions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SignupRequestRecord = {
  id: string;
  email: string;
  full_name: string | null;
  organization_name: string;
  status: "pending" | "approved" | "rejected" | "failed";
  notes: string | null;
  auth_user_id: string | null;
  organization_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_META = {
  pending: {
    label: "Pending",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  approved: {
    label: "Approved",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  rejected: {
    label: "Rejected",
    className: "border-zinc-200 bg-zinc-100 text-zinc-700",
  },
  failed: {
    label: "Failed",
    className: "border-rose-200 bg-rose-50 text-rose-800",
  },
} satisfies Record<
  SignupRequestRecord["status"],
  { label: string; className: string }
>;

function formatDate(value: string | null): string {
  if (!value) return "Non ancora";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getBanner(searchParams: Record<string, string | string[] | undefined>) {
  const notice = typeof searchParams.notice === "string" ? searchParams.notice : "";
  const error = typeof searchParams.error === "string" ? searchParams.error : "";

  if (notice === "approved") {
    return {
      tone: "success",
      text: "Richiesta approvata. Account, workspace e link di attivazione sono stati predisposti.",
    };
  }

  if (notice === "retry-approved") {
    return {
      tone: "success",
      text: "Provisioning completato al secondo tentativo. La richiesta e ora approvata.",
    };
  }

  if (notice === "rejected") {
    return {
      tone: "neutral",
      text: "Richiesta rifiutata correttamente.",
    };
  }

  if (notice === "already-approved") {
    return {
      tone: "neutral",
      text: "Questa richiesta era gia approvata.",
    };
  }

  if (error === "approval-failed") {
    return {
      tone: "error",
      text: "Il provisioning non si e concluso. La richiesta e stata marcata come failed per poterla ritentare.",
    };
  }

  if (error === "approval-not-allowed") {
    return {
      tone: "error",
      text: "Le richieste gia rifiutate non possono essere approvate direttamente. Serve una riapertura esplicita.",
    };
  }

  if (error === "rejection-not-allowed") {
    return {
      tone: "error",
      text: "Questa richiesta non puo essere rifiutata nello stato attuale.",
    };
  }

  if (error === "request-not-found") {
    return {
      tone: "error",
      text: "Richiesta non trovata.",
    };
  }

  if (error === "invalid-request") {
    return {
      tone: "error",
      text: "Operazione non valida.",
    };
  }

  return null;
}

function StatusBadge({ status }: { status: SignupRequestRecord["status"] }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function RequestActions({ request }: { request: SignupRequestRecord }) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={approveSignupRequestAction}>
        <input type="hidden" name="request_id" value={request.id} />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800"
        >
          {request.status === "failed" ? "Riprova provisioning" : "Approva"}
        </button>
      </form>

      {request.status === "pending" ? (
        <form action={rejectSignupRequestAction}>
          <input type="hidden" name="request_id" value={request.id} />
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Rifiuta
          </button>
        </form>
      ) : null}
    </div>
  );
}

async function loadSignupRequests(): Promise<SignupRequestRecord[]> {
  const supabase = supabaseAdmin();
  const result = await supabase
    .from("signup_requests")
    .select(
      "id, email, full_name, organization_name, status, notes, auth_user_id, organization_id, reviewed_by, reviewed_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data ?? []) as SignupRequestRecord[];
}

export default async function PlatformRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [requests, resolvedSearchParams] = await Promise.all([
    loadSignupRequests(),
    searchParams ?? Promise.resolve({}),
  ]);

  const queue = requests.filter(
    (request) => request.status === "pending" || request.status === "failed",
  );
  const history = requests.filter(
    (request) => request.status === "approved" || request.status === "rejected",
  );
  const counts = requests.reduce(
    (acc, request) => {
      acc[request.status] += 1;
      return acc;
    },
    { pending: 0, approved: 0, rejected: 0, failed: 0 },
  );
  const banner = getBanner(resolvedSearchParams);

  return (
    <div className="space-y-6">
      {banner ? (
        <div
          className={[
            "rounded-2xl border px-4 py-3 text-sm",
            banner.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
            banner.tone === "error" && "border-rose-200 bg-rose-50 text-rose-800",
            banner.tone === "neutral" && "border-zinc-200 bg-zinc-50 text-zinc-700",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {banner.text}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-500">Pending</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-900">{counts.pending}</p>
            </div>
            <Clock3 className="h-5 w-5 text-amber-500" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-500">Failed</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-900">{counts.failed}</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-rose-500" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-500">Approved</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-900">{counts.approved}</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-500">Rejected</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-900">{counts.rejected}</p>
            </div>
            <XCircle className="h-5 w-5 text-zinc-500" />
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <CardHeader
          title="Coda approvazioni"
          subtitle="Pending e failed richiedono un tuo intervento. I failed mantengono gli ID gia creati per consentire retry sicuri."
          action={<RefreshCcw className="h-4 w-4 text-blue-600" />}
        />

        {queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
            Nessuna richiesta in coda in questo momento.
          </div>
        ) : (
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Richiesta</TableHeaderCell>
                <TableHeaderCell>Workspace</TableHeaderCell>
                <TableHeaderCell>Stato</TableHeaderCell>
                <TableHeaderCell>Creata</TableHeaderCell>
                <TableHeaderCell>Dettagli</TableHeaderCell>
                <TableHeaderCell className="text-right">Azioni</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {queue.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium text-zinc-900">
                        {request.full_name || "Richiesta senza nome"}
                      </p>
                      <p className="text-sm text-zinc-500">{request.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-zinc-900">{request.organization_name}</p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={request.status} />
                  </TableCell>
                  <TableCell className="text-sm text-zinc-600">
                    {formatDate(request.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm text-zinc-600">
                      {request.auth_user_id ? <p>Auth pronto</p> : <p>Auth da creare</p>}
                      {request.organization_id ? <p>Workspace pronto</p> : <p>Workspace da creare</p>}
                      {request.notes ? (
                        <p className="max-w-md text-rose-700">{request.notes}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <RequestActions request={request} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Storico recente"
          subtitle="Visibilita rapida sulle richieste gia processate."
        />

        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
            Nessuna richiesta processata ancora.
          </div>
        ) : (
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Richiesta</TableHeaderCell>
                <TableHeaderCell>Workspace</TableHeaderCell>
                <TableHeaderCell>Stato</TableHeaderCell>
                <TableHeaderCell>Creata</TableHeaderCell>
                <TableHeaderCell>Revisionata</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {history.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium text-zinc-900">
                        {request.full_name || "Richiesta senza nome"}
                      </p>
                      <p className="text-sm text-zinc-500">{request.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-zinc-900">
                    {request.organization_name}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={request.status} />
                  </TableCell>
                  <TableCell className="text-sm text-zinc-600">
                    {formatDate(request.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-zinc-600">
                    {formatDate(request.reviewed_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
