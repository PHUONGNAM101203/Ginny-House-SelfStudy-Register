"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { UploadIcon } from "lucide-react"
import { importStudentsFromLarkAction } from "@/actions/students"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

// Same CSV shape scripts/import-lark.ts's CLI reads: header
// "lark_record_id,full_name,phone", plain comma-split (no quoted-field
// handling — matches the CLI script, which the same Lark export already
// works with).
function parseCsv(text: string): { fullName: string; phone: string; larkRecordId?: string }[] {
  const lines = text.replace(/^﻿/, "").trim().split("\n").map((line) => line.replace(/\r$/, ""))
  const [header, ...rows] = lines
  const cols = header.split(",")
  const idxRecordId = cols.indexOf("lark_record_id")
  const idxFullName = cols.indexOf("full_name")
  const idxPhone = cols.indexOf("phone")
  return rows
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const values = line.split(",")
      return {
        fullName: values[idxFullName]?.trim() ?? "",
        phone: values[idxPhone]?.trim() ?? "",
        larkRecordId: values[idxRecordId]?.trim() || undefined,
      }
    })
}

export function ImportLarkDialog() {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<{ fullName: string; phone: string; larkRecordId?: string }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setFileName(file.name)
    const text = await file.text()
    setRows(parseCsv(text))
  }

  async function submit() {
    if (rows.length === 0) return
    setSubmitting(true)
    const result = await importStudentsFromLarkAction({ rows })
    setSubmitting(false)
    if (!result.ok) return toast.error(result.error)
    toast.success(`Đã nhập ${result.data.count} học sinh`)
    setOpen(false)
    setFileName(null)
    setRows([])
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="w-fit">
        <UploadIcon />
        Nhập từ Lark Base
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nhập học sinh từ Lark Base</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Chọn file CSV xuất từ Lark Base (cột: lark_record_id, full_name, phone).
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
            {fileName && (
              <p className="text-sm">
                {fileName} — tìm thấy <span className="font-medium">{rows.length}</span> dòng.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={submitting || rows.length === 0}>
              {submitting ? "Đang nhập..." : `Nhập ${rows.length > 0 ? rows.length : ""} học sinh`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
