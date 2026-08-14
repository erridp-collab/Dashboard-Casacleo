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
    className: "border-semantic-warning/25 bg-semantic-warning/8 text-text-primary",
  },
  approved: {
    label: "Approved",
    className: "border-semantic-success/25 bg-semantic-success/8 text-semantic-success",
  },
  rejected: {
    label: "Rejected",
    className: "border-border-strong/15 bg-surface-muted text-text-secondary",
  },
  failed: {
    label: "Failed",
    className: "border-semantic-error/25 bg-semantic-error/8 text-text-primary",
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
          className="btn-primary btn-sm"
        >
          {request.status === "failed" ? "Riprova provisioning" : "Approva"}
        </button>
      </form>

      {request.status === "pending" ? (
        <form action={rejectSignupRequestAction}>
          <input type="hidden" name="request_id" value={request.id} />
          <button
            type="submit"
            className="btn-secondary btn-sm"
          >
            Rifiuta
          </button>
        </form>
      ) : null}
    </div>
  );
}

function RequestQueueCard({ request }: { request: SignupRequestRecord }) {
  return (
    <div className="space-y-3 rounded-xl border border-border-strong/12 bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">
            {request.full_name || "Senza nome"}
          </p>
          <p className="truncate text-sm text-text-muted">{request.email}</p>
          <p className="mt-0.5 text-sm text-text-secondary">{request.organization_name}</p>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <div className="space-y-0.5 text-xs text-text-muted">
        <p>{request.auth_user_id ? "Auth pronto" : "Auth da creare"}</p>
        <p>{request.organization_id ? "Workspace pronto" : "Workspace da creare"}</p>
        {request.notes ? <p className="text-semantic-error">{request.notes}</p> : null}
        <p>Ricevuta: {formatDate(request.created_at)}</p>
      </div>
      <RequestActions request={request} />
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
            banner.tone === "success" && "border-semantic-success/25 bg-semantic-success/8 text-semantic-success",
            banner.tone === "error" && "border-semantic-error/25 bg-semantic-error/8 text-text-primary",
            banner.tone === "neutral" && "border-border-strong/15 bg-surface-muted text-text-secondary",
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
              <p className="text-sm text-text-secondary">Pending</p>
              <p className="mt-2 text-3xl font-semibold text-text-primary">{counts.pending}</p>
            </div>
            <Clock3 className="h-5 w-5 text-semantic-warning" aria-hidden="true" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Failed</p>
              <p className="mt-2 text-3xl font-semibold text-text-primary">{counts.failed}</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-semantic-error" aria-hidden="true" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Approved</p>
              <p className="mt-2 text-3xl font-semibold text-text-primary">{counts.approved}</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-semantic-success" aria-hidden="true" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Rejected</p>
              <p className="mt-2 text-3xl font-semibold text-text-primary">{counts.rejected}</p>
            </div>
            <XCircle className="h-5 w-5 text-text-muted" aria-hidden="true" />
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <CardHeader
          title="Coda approvazioni"
          subtitle="Pending e failed richiedono un tuo intervento. I failed mantengono gli ID gia creati per consentire retry sicuri."
          action={<RefreshCcw className="h-4 w-4 text-brand-primary" aria-hidden="true" />}
        />

        {queue.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong/25 bg-surface-muted p-6 text-sm text-text-secondary">
            Nessuna richiesta in coda in questo momento.
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((request) => (
              <RequestQueueCard key={request.id} request={request} />
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Storico recente"
          subtitle="Visibilita rapida sulle richieste gia processate."
        />

        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong/25 bg-surface-muted p-6 text-sm text-text-secondary">
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
                      <p className="font-medium text-text-primary">
                        {request.full_name || "Richiesta senza nome"}
                      </p>
                      <p className="text-sm text-text-muted">{request.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-text-primary">
                    {request.organization_name}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={request.status} />
                  </TableCell>
                  <TableCell className="text-sm text-text-secondary">
                    {formatDate(request.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-text-secondary">
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
