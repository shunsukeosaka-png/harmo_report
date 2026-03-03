CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  address TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  work_type TEXT NOT NULL,
  has_fault_info BOOLEAN NOT NULL DEFAULT false,
  fault_info TEXT,
  work_hours NUMERIC(8, 2) NOT NULL CHECK (work_hours >= 0),
  created_by TEXT NOT NULL,
  created_at DATE NOT NULL DEFAULT CURRENT_DATE,
  CONSTRAINT chk_reports_fault_info_consistency CHECK (
    (has_fault_info = true AND fault_info IS NOT NULL AND btrim(fault_info) <> '')
    OR (has_fault_info = false AND fault_info IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS report_parts (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  part_number TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_report_parts_report_id ON report_parts(report_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
