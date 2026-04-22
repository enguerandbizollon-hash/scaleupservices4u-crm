"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck } from "lucide-react";
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "@/actions/notifications";
import type { NotificationRow } from "@/lib/crm/notifications";

const POLL_MS = 60_000;

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const refresh = useCallback(async () => {
    const c = await getUnreadCount();
    setCount(c);
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    const rows = await listNotifications({ limit: 30 });
    setItems(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (open) void loadList();
  }, [open, loadList]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function onItemClick(id: string) {
    await markAsRead(id);
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    void refresh();
  }

  async function onMarkAll() {
    await markAllAsRead();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    void refresh();
  }

  return (
    <div style={{ position: "relative", padding: "0 10px 8px 10px" }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "9px 11px",
          borderRadius: 10,
          background: open ? "rgba(255,255,255,.06)" : "transparent",
          border: "1px solid " + (open ? "rgba(255,255,255,.12)" : "transparent"),
          color: "rgba(255,255,255,.75)",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: 500,
          textAlign: "left",
          position: "relative",
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: "rgba(126,179,216,.15)",
            border: "1px solid rgba(126,179,216,.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Bell size={13} style={{ color: "#7EB3D8" }} strokeWidth={2} />
        </div>
        <span style={{ flex: 1 }}>Notifications</span>
        {count > 0 && (
          <span
            style={{
              minWidth: 18,
              height: 18,
              padding: "0 6px",
              borderRadius: 9,
              background: "#DC2626",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              letterSpacing: ".02em",
            }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          style={{
            position: "absolute",
            top: "100%",
            left: 10,
            right: 10,
            marginTop: 4,
            zIndex: 100,
            background: "#0f1830",
            border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 10,
            boxShadow: "0 20px 48px rgba(0,0,0,.4)",
            maxHeight: 480,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              borderBottom: "1px solid rgba(255,255,255,.07)",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.9)" }}>
              Notifications {count > 0 ? `(${count})` : ""}
            </span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => void onMarkAll()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,.12)",
                  color: "rgba(255,255,255,.7)",
                  cursor: "pointer",
                  fontSize: 11,
                  fontFamily: "inherit",
                }}
              >
                <CheckCheck size={11} strokeWidth={2} />
                Tout marquer lu
              </button>
            )}
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading && (
              <div style={{ padding: "20px 12px", fontSize: 12, color: "rgba(255,255,255,.4)" }}>
                Chargement...
              </div>
            )}
            {!loading && items.length === 0 && (
              <div style={{ padding: "24px 12px", fontSize: 12, color: "rgba(255,255,255,.4)" }}>
                Aucune notification.
              </div>
            )}
            {!loading &&
              items.map((n) => {
                const unread = !n.read_at;
                const inner = (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid rgba(255,255,255,.05)",
                      background: unread ? "rgba(126,179,216,.06)" : "transparent",
                      cursor: n.link_url ? "pointer" : "default",
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {unread && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            background: "#7EB3D8",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: unread ? 600 : 500,
                          color: unread ? "#fff" : "rgba(255,255,255,.65)",
                          flex: 1,
                        }}
                      >
                        {n.title}
                      </span>
                      {unread && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void onItemClick(n.id);
                          }}
                          aria-label="Marquer comme lu"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "rgba(255,255,255,.4)",
                            cursor: "pointer",
                            padding: 2,
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <Check size={12} strokeWidth={2} />
                        </button>
                      )}
                    </div>
                    {n.body && (
                      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.55)", lineHeight: 1.4 }}>
                        {n.body}
                      </div>
                    )}
                    <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.35)", marginTop: 2 }}>
                      {formatRelative(n.created_at)}
                    </div>
                  </div>
                );
                return n.link_url ? (
                  <Link
                    key={n.id}
                    href={n.link_url}
                    onClick={() => void onItemClick(n.id)}
                    style={{ textDecoration: "none", color: "inherit", display: "block" }}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
