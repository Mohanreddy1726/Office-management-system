// Generic data table: sorting, pagination, row click. Used by every module.
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
  hideOnMobile?: boolean;
}

export function DataTable<T>({ columns, rows, pageSize = 10, emptyTitle = "No records", emptyHint, onRowClick, rowKey, toolbar, footer }: {
  columns: Column<T>[];
  rows: T[];
  pageSize?: number;
  emptyTitle?: string;
  emptyHint?: string;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  toolbar?: ReactNode;
  footer?: ReactNode;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a), bv = col.sortValue!(b);
      if (av < bv) return -sort.dir;
      if (av > bv) return sort.dir;
      return 0;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const slice = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  if (!rows.length) {
    return (
      <div>
        {toolbar}
        <EmptyState title={emptyTitle} hint={emptyHint} />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {toolbar && <div className="border-b border-border p-3">{toolbar}</div>}
      <div className="overflow-x-auto scrollbar-thin">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(
                    "whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                    c.hideOnMobile && "hidden md:table-cell",
                    c.sortValue && "cursor-pointer select-none hover:text-foreground",
                  )}
                  onClick={() => c.sortValue && setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.header}
                    {sort?.key === c.key && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {slice.map((row) => (
              <TableRow
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={cn("border-border", onRowClick && "cursor-pointer hover:bg-blue-soft/40")}
              >
                {columns.map((c) => (
                  <TableCell key={c.key} className={cn("whitespace-nowrap px-3 text-[13px]", c.hideOnMobile && "hidden md:table-cell", c.className)}>
                    {c.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <span>
          {sorted.length === 0 ? 0 : safePage * pageSize + 1}–{Math.min(sorted.length, safePage * pageSize + pageSize)} of {sorted.length}
        </span>
        <div className="flex items-center gap-1">
          {footer}
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span>Page {safePage + 1} / {pages}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
