import { readFileSync } from "node:fs"
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"

config({ path: ".env.local" })

type LarkRow = { lark_record_id: string; full_name: string; phone: string }

function parseCsv(path: string): LarkRow[] {
  const raw = readFileSync(path, "utf-8").replace(/^﻿/, "")
  const lines = raw.trim().split("\n").map((line) => line.replace(/\r$/, ""))
  const [header, ...rows] = lines
  const cols = header.split(",")
  return rows.map((line) => {
    const values = line.split(",")
    const row = Object.fromEntries(cols.map((c, i) => [c, values[i]])) as LarkRow
    return row
  })
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error("Usage: tsx scripts/import-lark.ts <path-to-export.csv>")
    process.exit(1)
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const rows = parseCsv(csvPath)

  let imported = 0
  let skipped = 0
  for (const row of rows) {
    const { error } = await supabase
      .from("students")
      .upsert({ full_name: row.full_name, phone: row.phone, lark_record_id: row.lark_record_id }, { onConflict: "phone" })
    if (error) {
      console.error(`Skipped ${row.full_name} (${row.phone}): ${error.message}`)
      skipped += 1
    } else {
      imported += 1
    }
  }

  console.log(`Imported ${imported} students, skipped ${skipped}.`)
}

main()
