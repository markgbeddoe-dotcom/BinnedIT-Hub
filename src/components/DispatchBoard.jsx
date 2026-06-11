import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { fontHead, fontBody } from '../theme';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useBookings, useUpdateBookingStatus, useCreateBooking, useAssignDriver, assignmentStatusFor } from '../hooks/useBookings';
import { useDrivers, useTrucks } from '../hooks/useDrivers';
import JobCostingWidget from './driver/JobCostingWidget';

// WP-C (R3): lazy so leaflet/react-leaflet stay out of the main chunk —
// the map code loads only when dispatch toggles it on.
const LiveMapPanel = React.lazy(() => import('./LiveMapPanel'));

// Persist the "Show job costing on cards" toggle locally. Defaults OFF
// (audit P0-8 requirement: opt-in to avoid first-time visual noise).
const COSTING_TOGGLE_KEY = 'skipsync.dispatch.showJobCosting';

function readCostingToggle() {
  try {
    return localStorage.getItem(COSTING_TOGGLE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeCostingToggle(v) {
  try {
    localStorage.setItem(COSTING_TOGGLE_KEY, v ? 'true' : 'false');
  } catch {
    /* localStorage unavailable (private browsing) — toggle is session-only */
  }
}

// ─── Dark dispatch theme ──────────────────────────────────────────────────────
const D = {
  bg:           '#1A1A2E',
  surface:      '#16213E',
  card:         '#2D2D44',
  cardHover:    '#383856',
  border:       '#3D3D5C',
  borderLight:  '#4D4D6C',
  text:         '#E8E8F0',
  textSub:      '#B0B0C8',
  textMuted:    '#7878A0',
  accent:       '#F59E0B',
};

const COLUMNS = [
  { id: 'pending',     label: 'Pending',     color: '#F59E0B', icon: '⏳', desc: 'Awaiting scheduling' },
  { id: 'scheduled',   label: 'Scheduled',   color: '#3B82F6', icon: '📅', desc: 'Assigned & ready' },
  { id: 'in_progress', label: 'In Progress', color: '#8B5CF6', icon: '🚛', desc: 'Driver on job' },
  { id: 'completed',   label: 'Completed',   color: '#10B981', icon: '✓',  desc: 'Done' },
];

const WASTE_COLORS = {
  'General Waste': '#7B8FD4',
  'Asbestos':      '#D4839B',
  'Soil':          '#9B8EC9',
  'Green Waste':   '#5E9E78',
  'Other':         '#8B6EB5',
};

// Sample assigned jobs carry a (fake) driver_id so the ⚠ UNASSIGNED chip —
// which keys off driver_id, never the display name (ADR-708 risk 10) —
// renders sensibly in sample mode.
const SAMPLE_JOBS = [
  { id: 's1', customer_name: 'Smith Constructions', bin_size: '4m³', waste_type: 'General Waste', address: '12 Main St', suburb: 'Seaford',    status: 'pending',     driver_id: null,            driver_name: null,           truck_id: null,    scheduled_date: null,         estimated_cost: 285, margin_pct: 42, notes: '' },
  { id: 's2', customer_name: 'Nguyen Renovations',  bin_size: '6m³', waste_type: 'Soil',          address: '45 Beach Rd', suburb: 'Frankston', status: 'pending',     driver_id: null,            driver_name: null,           truck_id: null,    scheduled_date: null,         estimated_cost: 420, margin_pct: 38, notes: 'Access via rear lane' },
  { id: 's3', customer_name: 'Mornington Council',  bin_size: '8m³', waste_type: 'Green Waste',   address: '88 Council Way', suburb: 'Mornington', status: 'scheduled', driver_id: 'sample-jake', driver_name: 'Jake Thompson', truck_id: 'TRK-01', scheduled_date: '2026-04-05', estimated_cost: 580, margin_pct: 45, notes: 'Early morning start' },
  { id: 's4', customer_name: 'Peninsula Builders',  bin_size: '4m³', waste_type: 'General Waste', address: '15 Trade St', suburb: 'Rosebud',   status: 'scheduled',   driver_id: 'sample-mike',   driver_name: 'Mike Chen',    truck_id: 'TRK-02', scheduled_date: '2026-04-05', estimated_cost: 285, margin_pct: 40, notes: '' },
  { id: 's5', customer_name: 'Carrum Demolitions',  bin_size: '10m³', waste_type: 'Asbestos',     address: '7 Old Rd',    suburb: 'Carrum',    status: 'in_progress', driver_id: 'sample-jake',   driver_name: 'Jake Thompson', truck_id: 'TRK-01', scheduled_date: '2026-04-04', estimated_cost: 890, margin_pct: 52, notes: 'PPE required — asbestos removal' },
  { id: 's6', customer_name: 'Seaford Hardware',    bin_size: '6m³', waste_type: 'General Waste', address: '22 Industrial Dr', suburb: 'Seaford', status: 'completed', driver_id: 'sample-mike', driver_name: 'Mike Chen',   truck_id: 'TRK-02', scheduled_date: '2026-04-03', estimated_cost: 360, margin_pct: 44, notes: '' },
  { id: 's7', customer_name: 'Frankston Council',   bin_size: '8m³', waste_type: 'Green Waste',   address: '55 Park Ave', suburb: 'Frankston', status: 'completed',   driver_id: 'sample-jake',   driver_name: 'Jake Thompson', truck_id: 'TRK-01', scheduled_date: '2026-04-03', estimated_cost: 520, margin_pct: 46, notes: '' },
];

// Statuses where a missing driver_id is a problem worth flagging
// (pending cards are expected to be unassigned — no chip noise there).
const CHIP_STATUSES = ['scheduled', 'in_progress'];

function fmtCost(v) {
  if (!v && v !== 0) return '—';
  return `$${Math.round(v).toLocaleString('en-AU')}`;
}

// ─── Unassigned warning chip (ux-spec-v7 §1.3) ────────────────────────────────
function UnassignedChip({ onClick }) {
  return (
    <button
      type="button"
      data-testid="unassigned-chip"
      title="No driver assigned — click to assign"
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: '#F59E0B22', border: '1px solid #F59E0B', color: '#FFC75A',
        fontSize: 11, fontFamily: fontHead, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.05em',
        borderRadius: 4, padding: '2px 8px', marginBottom: 8, cursor: 'pointer',
      }}
    >
      ⚠ Unassigned
    </button>
  );
}

// ─── Assignment sub-panel inside the expanded card (ux-spec-v7 §1.1) ─────────
function AssignmentPanel({ job, driverRoster, truckRoster, rosterLoading, disabled, onAssign }) {
  const [driverId, setDriverId] = useState(job.driver_id || '');
  const [truckId, setTruckId]   = useState(job.truck_id || '');
  const [date, setDate]         = useState(job.scheduled_date || '');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(false);

  const rosterEmpty = !rosterLoading && driverRoster.length === 0;
  const canAssign = !!driverId && !saving && !disabled;
  const sampleTooltip = disabled ? 'Sample data — connect the bookings table to assign drivers' : undefined;

  const labelStyle = {
    fontSize: 10, color: D.textSub, fontFamily: fontHead,
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
  };
  const fieldStyle = {
    background: D.border, border: `1px solid ${D.borderLight}`, borderRadius: 6,
    padding: '8px 10px', color: D.text, fontSize: 13, fontFamily: fontBody,
    width: '100%', outline: 'none', boxSizing: 'border-box', marginBottom: 10,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
  };

  const save = (fields) => {
    setSaving(true); setError(false);
    onAssign(job, fields, {
      onError: () => { setSaving(false); setError(true); },
      onSuccess: () => { setSaving(false); },
    });
  };

  const handleAssignClick = () => {
    const selDriver = driverRoster.find(d => d.id === driverId);
    save({
      driver_id: driverId || null,
      driver_name: selDriver ? selDriver.full_name : null,
      truck_id: truckId || null,
      scheduled_date: date || null,
    });
  };

  const handleClearClick = () => {
    setDriverId('');
    save({
      driver_id: null,
      driver_name: null,
      truck_id: truckId || null,
      scheduled_date: date || null,
    });
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      data-testid="assignment-panel"
      title={sampleTooltip}
      style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 8, padding: 12, marginTop: 10 }}
    >
      <div style={{ fontSize: 10, color: D.textSub, fontFamily: fontHead, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        Assignment
      </div>

      <div style={labelStyle}>Driver</div>
      <select
        data-testid="assign-driver-select"
        value={driverId}
        onChange={e => setDriverId(e.target.value)}
        disabled={disabled || rosterLoading || rosterEmpty}
        title={sampleTooltip}
        style={fieldStyle}
      >
        {rosterLoading && <option value="">Loading…</option>}
        {rosterEmpty && <option value="">No drivers yet — add in Team page</option>}
        {!rosterLoading && !rosterEmpty && <option value="">— Unassigned —</option>}
        {!rosterLoading && driverRoster.map(d => (
          <option key={d.id} value={d.id}>{d.full_name || d.id}</option>
        ))}
      </select>
      {rosterEmpty && (
        <div style={{ fontSize: 12, color: D.textSub, marginTop: -4, marginBottom: 10 }}>
          Add drivers with the 'driver' role on the Team page.
        </div>
      )}

      <div style={labelStyle}>Truck</div>
      <select
        data-testid="assign-truck-select"
        value={truckId}
        onChange={e => setTruckId(e.target.value)}
        disabled={disabled}
        title={sampleTooltip}
        style={fieldStyle}
      >
        <option value="">— None —</option>
        {truckRoster.map(t => (
          <option key={t.id} value={t.identifier}>
            {t.identifier}{t.description ? ` — ${t.description}` : ''}
          </option>
        ))}
        {/* Keep a legacy truck_id visible/selectable even if it's not in the roster */}
        {job.truck_id && !truckRoster.some(t => t.identifier === job.truck_id) && (
          <option value={job.truck_id}>{job.truck_id}</option>
        )}
      </select>

      <div style={labelStyle}>Date</div>
      <input
        type="date"
        data-testid="assign-date-input"
        value={date}
        onChange={e => setDate(e.target.value)}
        disabled={disabled}
        title={sampleTooltip}
        style={fieldStyle}
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          data-testid="assign-save-btn"
          onClick={handleAssignClick}
          disabled={!canAssign}
          title={sampleTooltip}
          style={{
            flex: 1, minHeight: 44,
            background: canAssign ? D.accent : D.border,
            color: canAssign ? '#0A0A0A' : D.textMuted,
            border: 'none', borderRadius: 8,
            cursor: canAssign ? 'pointer' : 'not-allowed',
            fontFamily: fontHead, fontWeight: 700, fontSize: 13,
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}
        >
          {saving ? 'Saving…' : 'Assign'}
        </button>
        <button
          type="button"
          data-testid="assign-clear-btn"
          onClick={handleClearClick}
          disabled={disabled || saving || (!job.driver_id && !driverId)}
          title={sampleTooltip}
          style={{
            minHeight: 44, padding: '0 14px',
            background: 'none', border: `1px solid ${D.border}`, borderRadius: 8,
            color: D.textSub, fontFamily: fontHead, fontSize: 12,
            cursor: (disabled || saving) ? 'not-allowed' : 'pointer',
          }}
        >
          Clear
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#E07B7B', marginTop: 8 }}>
          ⚠ Couldn't save assignment — retry
        </div>
      )}
      {disabled && (
        <div style={{ fontSize: 11, color: D.textSub, marginTop: 8, fontStyle: 'italic' }}>
          Assignment disabled on sample data
        </div>
      )}
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ job, index, expandedId, onExpand, showJobCosting, driverRoster, truckRoster, rosterLoading, isUsingSamples, onAssign }) {
  const isExpanded = expandedId === job.id;
  const colColor = COLUMNS.find(c => c.id === job.status)?.color || '#999';
  const wasteColor = WASTE_COLORS[job.waste_type] || '#8B6EB5';

  return (
    <Draggable draggableId={job.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onExpand(job.id)}
          style={{
            ...provided.draggableProps.style,
            background: snapshot.isDragging ? D.cardHover : D.card,
            borderRadius: 10,
            marginBottom: 10,
            border: `1px solid ${snapshot.isDragging ? colColor : D.border}`,
            borderLeft: `4px solid ${D.accent}`,
            cursor: 'grab',
            boxShadow: snapshot.isDragging
              ? '0 12px 32px rgba(0,0,0,0.6)'
              : '0 2px 6px rgba(0,0,0,0.25)',
            transition: snapshot.isDragging ? 'none' : 'box-shadow 0.15s, background 0.15s',
            userSelect: 'none',
          }}
        >
          {/* ── Compact view ── */}
          <div style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
              <div style={{ fontFamily: fontHead, fontWeight: 700, fontSize: 14, color: D.text, lineHeight: 1.2 }}>
                {job.customer_name}
              </div>
              <div style={{
                fontSize: 10, fontWeight: 700, color: colColor,
                background: `${colColor}22`, borderRadius: 4,
                padding: '2px 7px', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {job.status.replace('_', ' ')}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 5, marginBottom: 7, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: D.text, background: D.border, borderRadius: 4, padding: '2px 7px', fontFamily: fontHead }}>
                {job.bin_size}
              </span>
              <span style={{ fontSize: 11, color: wasteColor, background: `${wasteColor}22`, borderRadius: 4, padding: '2px 7px' }}>
                {job.waste_type}
              </span>
            </div>

            <div style={{ fontSize: 12, color: D.textMuted, marginBottom: 5 }}>
              📍 {job.suburb}
            </div>

            {/* Driver row, or the ⚠ UNASSIGNED chip in its place (chip keys
                off driver_id — the source of truth — never the text field) */}
            {CHIP_STATUSES.includes(job.status) && !job.driver_id ? (
              <UnassignedChip onClick={() => { if (!isExpanded) onExpand(job.id); }} />
            ) : (job.driver_name || job.driver_name_assigned) ? (
              <div style={{ fontSize: 11, color: D.textSub, marginBottom: 8 }}>
                👤 {job.driver_name || job.driver_name_assigned}{job.truck_id ? ` · 🚛 ${job.truck_id}` : ''}
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: fontHead, fontWeight: 700, fontSize: 15, color: D.accent }}>
                {fmtCost(job.estimated_cost)}
              </div>
              {job.margin_pct != null && job.margin_pct > 0 && (
                <div style={{ fontSize: 11, color: '#10B981', fontWeight: 700 }}>
                  {job.margin_pct}% margin
                </div>
              )}
            </div>
          </div>

          {/* ── Expanded details ── */}
          {isExpanded && (
            <div style={{ borderTop: `1px solid ${D.border}`, padding: '10px 14px 14px' }}>
              {job.address && (
                <div style={{ fontSize: 12, color: D.textSub, marginBottom: 4 }}>
                  📍 {job.address}, {job.suburb}
                </div>
              )}
              {job.scheduled_date && (
                <div style={{ fontSize: 12, color: D.textSub, marginBottom: 4 }}>
                  📅 {new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString('en-AU', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </div>
              )}
              {job.notes && (
                <div style={{ fontSize: 12, color: D.accent, marginTop: 6, fontStyle: 'italic', lineHeight: 1.4 }}>
                  📝 {job.notes}
                </div>
              )}

              {/* Driver/truck/date assignment — editable until completed (FR7.1.7) */}
              {job.status !== 'completed' && (
                <AssignmentPanel
                  key={`${job.id}-${job.driver_id || 'none'}-${job.truck_id || 'none'}-${job.scheduled_date || 'none'}`}
                  job={job}
                  driverRoster={driverRoster}
                  truckRoster={truckRoster}
                  rosterLoading={rosterLoading}
                  disabled={isUsingSamples}
                  onAssign={onAssign}
                />
              )}

              {/* Live job costing — opt-in via the "Show job costing" toggle (audit P0-8) */}
              {showJobCosting && (
                <div style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
                  <JobCostingWidget booking={job} compact />
                </div>
              )}

              <div style={{ fontSize: 10, color: D.textMuted, marginTop: 8 }}>
                Click card to collapse
              </div>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────
function KanbanColumn({ column, jobs, expandedId, onExpand, showJobCosting, driverRoster, truckRoster, rosterLoading, isUsingSamples, onAssign }) {
  const unassignedCount = CHIP_STATUSES.includes(column.id)
    ? jobs.filter(j => !j.driver_id).length
    : 0;
  return (
    <div style={{ flex: '1 1 240px', minWidth: 220, maxWidth: 320 }}>
      {/* Header */}
      <div style={{
        background: column.color,
        borderRadius: '10px 10px 0 0',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>{column.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: fontHead, fontWeight: 700, fontSize: 14, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {column.label}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{column.desc}</div>
        </div>
        {unassignedCount > 0 && (
          <div
            data-testid={`unassigned-count-${column.id}`}
            title={`${unassignedCount} job${unassignedCount === 1 ? '' : 's'} without a driver`}
            style={{
              background: 'rgba(0,0,0,0.28)', borderRadius: 12,
              padding: '2px 8px', fontFamily: fontHead, fontWeight: 700, fontSize: 12, color: '#FFC75A',
            }}
          >
            ⚠{unassignedCount}
          </div>
        )}
        <div style={{
          background: 'rgba(0,0,0,0.28)', borderRadius: 12,
          padding: '2px 10px', fontFamily: fontHead, fontWeight: 700, fontSize: 14, color: '#fff',
        }}>
          {jobs.length}
        </div>
      </div>

      {/* Drop zone */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              background: snapshot.isDraggingOver ? `${column.color}18` : D.surface,
              border: `1px solid ${snapshot.isDraggingOver ? column.color : D.border}`,
              borderTop: 'none',
              borderRadius: '0 0 10px 10px',
              padding: 10,
              minHeight: 220,
              transition: 'background 0.2s, border-color 0.2s',
            }}
          >
            {jobs.map((job, index) => (
              <JobCard
                key={job.id}
                job={job}
                index={index}
                expandedId={expandedId}
                onExpand={onExpand}
                showJobCosting={showJobCosting}
                driverRoster={driverRoster}
                truckRoster={truckRoster}
                rosterLoading={rosterLoading}
                isUsingSamples={isUsingSamples}
                onAssign={onAssign}
              />
            ))}
            {provided.placeholder}
            {jobs.length === 0 && !snapshot.isDraggingOver && (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: D.textMuted, fontSize: 12 }}>
                Drop jobs here
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}

// ─── New Job Form Modal ───────────────────────────────────────────────────────
function NewJobModal({ onSubmit, onClose, driverRoster, truckRoster, rosterLoading, isUsingSamples }) {
  const [form, setForm] = useState({
    customer_name: '', bin_size: '4m³', waste_type: 'General Waste',
    address: '', suburb: '', estimated_cost: '', margin_pct: '', notes: '',
    driver_id: '', truck_id: '', scheduled_date: '',
  });

  const rosterEmpty = !rosterLoading && driverRoster.length === 0;
  const sampleTooltip = isUsingSamples ? 'Sample data — connect the bookings table to assign drivers' : undefined;

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const inputStyle = {
    background: D.border, border: `1px solid ${D.borderLight}`,
    borderRadius: 6, padding: '8px 10px', color: D.text,
    fontSize: 13, fontFamily: fontBody, width: '100%', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 14, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontFamily: fontHead, fontSize: 18, fontWeight: 700, color: D.text, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 20 }}>
          New Job
        </div>

        {[
          { label: 'Customer Name *', key: 'customer_name', type: 'text' },
          { label: 'Address', key: 'address', type: 'text' },
          { label: 'Suburb', key: 'suburb', type: 'text' },
          { label: 'Estimated Cost ($)', key: 'estimated_cost', type: 'number' },
          { label: 'Margin %', key: 'margin_pct', type: 'number' },
          { label: 'Notes', key: 'notes', type: 'text' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: D.textMuted, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{f.label}</div>
            <input type={f.type} value={form[f.key]} onChange={e => set(f.key, e.target.value)} style={inputStyle} />
          </div>
        ))}

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: D.textMuted, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Bin Size</div>
          <select value={form.bin_size} onChange={e => set('bin_size', e.target.value)} style={inputStyle}>
            {['2m³', '3m³', '4m³', '6m³', '8m³', '10m³', '12m³'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: D.textMuted, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Waste Type</div>
          <select value={form.waste_type} onChange={e => set('waste_type', e.target.value)} style={inputStyle}>
            {['General Waste', 'Soil', 'Green Waste', 'Asbestos', 'Other'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* ── Assignment (optional) — ux-spec-v7 §1.2 / FR7.1.4 ── */}
        <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: D.textMuted, fontFamily: fontHead, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Assignment (optional)
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: D.textMuted, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Driver</div>
            <select
              data-testid="newjob-driver-select"
              value={form.driver_id}
              onChange={e => set('driver_id', e.target.value)}
              disabled={isUsingSamples || rosterLoading || rosterEmpty}
              title={sampleTooltip}
              style={{ ...inputStyle, opacity: isUsingSamples ? 0.55 : 1 }}
            >
              {rosterLoading && <option value="">Loading…</option>}
              {rosterEmpty && <option value="">No drivers yet — add in Team page</option>}
              {!rosterLoading && !rosterEmpty && <option value="">Unassigned</option>}
              {!rosterLoading && driverRoster.map(d => (
                <option key={d.id} value={d.id}>{d.full_name || d.id}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: D.textMuted, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Truck</div>
            <select
              data-testid="newjob-truck-select"
              value={form.truck_id}
              onChange={e => set('truck_id', e.target.value)}
              disabled={isUsingSamples}
              title={sampleTooltip}
              style={{ ...inputStyle, opacity: isUsingSamples ? 0.55 : 1 }}
            >
              <option value="">None</option>
              {truckRoster.map(t => (
                <option key={t.id} value={t.identifier}>
                  {t.identifier}{t.description ? ` — ${t.description}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: D.textMuted, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Scheduled Date</div>
            <input
              type="date"
              data-testid="newjob-date-input"
              value={form.scheduled_date}
              onChange={e => set('scheduled_date', e.target.value)}
              disabled={isUsingSamples}
              title={sampleTooltip}
              style={{ ...inputStyle, opacity: isUsingSamples ? 0.55 : 1 }}
            />
          </div>

          <div style={{ fontSize: 11, color: D.textSub, lineHeight: 1.4, marginBottom: 8 }}>
            ⓘ Driver + date → job lands in Scheduled. Leaving driver empty creates the job in Pending with an ⚠ chip.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => onSubmit(form)}
            disabled={!form.customer_name}
            style={{ flex: 1, background: form.customer_name ? D.accent : D.border, color: form.customer_name ? '#0A0A0A' : D.textMuted, border: 'none', borderRadius: 8, padding: '12px', cursor: form.customer_name ? 'pointer' : 'not-allowed', fontFamily: fontHead, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', transition: 'background 0.15s' }}
          >
            Add Job
          </button>
          <button
            onClick={onClose}
            style={{ flex: 1, background: 'none', border: `1px solid ${D.border}`, borderRadius: 8, padding: '12px', cursor: 'pointer', color: D.textMuted, fontFamily: fontHead, fontSize: 13 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Board ───────────────────────────────────────────────────────────────
export default function DispatchBoard() {
  const { isMobile } = useBreakpoint();
  const [expandedId, setExpandedId]         = useState(null);
  const [filterDriver, setFilterDriver]     = useState('');
  const [showNewJob, setShowNewJob]         = useState(false);
  const [localJobs, setLocalJobs]           = useState(null);
  const [showLiveMap, setShowLiveMap]       = useState(false);
  // Audit P0-8: opt-in "Show job costing on cards" — defaults OFF for first-time users.
  const [showJobCosting, setShowJobCosting] = useState(() => readCostingToggle());

  useEffect(() => { writeCostingToggle(showJobCosting); }, [showJobCosting]);

  const { data: supabaseJobs, isLoading, isError } = useBookings();
  const updateStatus    = useUpdateBookingStatus();
  const createBookingMut = useCreateBooking();
  const assignDriverMut  = useAssignDriver();

  // Driver/truck rosters (WP-A) — resolve to [] on any error (fallback convention)
  const { data: driverRoster = [], isLoading: rosterLoading } = useDrivers();
  const { data: truckRoster = [] } = useTrucks();

  // Use Supabase data if table has rows, otherwise fall back to samples
  const baseJobs = useMemo(() => {
    if (supabaseJobs && supabaseJobs.length > 0) return supabaseJobs;
    return SAMPLE_JOBS;
  }, [supabaseJobs]);

  const jobs = localJobs ?? baseJobs;
  const isUsingSamples = !supabaseJobs || supabaseJobs.length === 0;

  // Reset local optimistic state when base data changes after Supabase response
  const prevBase = useRef(baseJobs);
  if (prevBase.current !== baseJobs) {
    prevBase.current = baseJobs;
    setLocalJobs(null);
  }

  // ── Driver filter (ux-spec-v7 §1.4): roster-based with "Unassigned only"
  // and legacy free-text names. Filter values:
  //   ''                → all jobs
  //   'unassigned'      → driver_id == null
  //   'd:<uuid>'        → roster driver (matches driver_id, or legacy
  //                       driver_name rows that equal that driver's name)
  //   'legacy:<name>'   → free-text driver_name with no roster match
  //   '<name>'          → pre-roster fallback (empty roster: derived names)
  const hasRoster = driverRoster.length > 0;

  const legacyNames = useMemo(() => {
    const rosterIds = new Set(driverRoster.map(d => d.id));
    const rosterNames = new Set(driverRoster.map(d => d.full_name));
    return [...new Set(
      jobs
        .filter(j => j.driver_name && !rosterNames.has(j.driver_name) && !(j.driver_id && rosterIds.has(j.driver_id)))
        .map(j => j.driver_name)
    )];
  }, [jobs, driverRoster]);

  // Pre-roster fallback: names derived from jobs (original behaviour) so the
  // board never breaks before migration 022 / driver onboarding.
  const derivedNames = useMemo(() => (
    [...new Set(jobs.filter(j => j.driver_name).map(j => j.driver_name))]
  ), [jobs]);

  const matchesDriverFilter = useCallback((job, filter) => {
    if (!filter) return true;
    if (filter === 'unassigned') return !job.driver_id;
    if (filter.startsWith('d:')) {
      const id = filter.slice(2);
      if (job.driver_id === id) return true;
      // Legacy rows assigned by name only still match their roster driver
      const d = driverRoster.find(r => r.id === id);
      return !!d && !job.driver_id && job.driver_name === d.full_name;
    }
    if (filter.startsWith('legacy:')) return job.driver_name === filter.slice(7);
    return job.driver_name === filter; // pre-roster fallback value
  }, [driverRoster]);

  const filteredJobs = useMemo(() => (
    filterDriver ? jobs.filter(j => matchesDriverFilter(j, filterDriver)) : jobs
  ), [jobs, filterDriver, matchesDriverFilter]);

  const filterJobCount = useCallback((filter) => (
    jobs.filter(j => matchesDriverFilter(j, filter)).length
  ), [jobs, matchesDriverFilter]);

  const columnJobs = useMemo(() => {
    const map = {};
    COLUMNS.forEach(c => { map[c.id] = filteredJobs.filter(j => j.status === c.id); });
    return map;
  }, [filteredJobs]);

  const stats = useMemo(() => ({
    total:       jobs.length,
    pending:     jobs.filter(j => j.status === 'pending').length,
    inProgress:  jobs.filter(j => j.status === 'in_progress').length,
    completed:   jobs.filter(j => j.status === 'completed').length,
    pipeline:    jobs.filter(j => j.status !== 'completed').reduce((s, j) => s + (j.estimated_cost || 0), 0),
  }), [jobs]);

  const handleExpand = useCallback((id) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const handleDragEnd = useCallback((result) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;
    const job = jobs.find(j => j.id === draggableId);
    if (!job || job.status === newStatus) return;

    // Optimistic update
    setLocalJobs(jobs.map(j => j.id === draggableId ? { ...j, status: newStatus } : j));

    if (!isUsingSamples) {
      updateStatus.mutate({ id: draggableId, status: newStatus }, {
        onError: () => setLocalJobs(null),   // rollback
        onSuccess: () => setLocalJobs(null), // hand off to TanStack Query
      });
    }
  }, [jobs, isUsingSamples, updateStatus]);

  // WP-A: assign/reassign/clear driver+truck+date on an existing card.
  // Optimistic local update (same pattern as handleDragEnd), rolls back on
  // error; the panel surfaces the inline error message via callbacks.
  const handleAssign = useCallback((job, fields, callbacks) => {
    if (isUsingSamples) return;
    const nextStatus = assignmentStatusFor(job.status, fields.driver_id, fields.scheduled_date);
    setLocalJobs(jobs.map(j => (
      j.id === job.id
        ? { ...j, ...fields, driver_name_assigned: fields.driver_name, status: nextStatus }
        : j
    )));
    assignDriverMut.mutate(
      { id: job.id, currentStatus: job.status, ...fields },
      {
        onError: (err) => { setLocalJobs(null); callbacks?.onError?.(err); },
        onSuccess: () => { setLocalJobs(null); callbacks?.onSuccess?.(); },
      }
    );
  }, [jobs, isUsingSamples, assignDriverMut]);

  const handleNewJobSubmit = useCallback((form) => {
    const selDriver = driverRoster.find(d => d.id === form.driver_id);
    // FR7.1.4: driver + date at creation → job is born Scheduled; else Pending.
    const bornScheduled = !!(form.driver_id && form.scheduled_date);
    const job = {
      ...form,
      status: bornScheduled ? 'scheduled' : 'pending',
      estimated_cost: parseFloat(form.estimated_cost) || 0,
      margin_pct: parseFloat(form.margin_pct) || null,
      driver_id: form.driver_id || null,
      driver_name: selDriver ? selDriver.full_name : null,
      driver_name_assigned: selDriver ? selDriver.full_name : null,
      truck_id: form.truck_id || null,
      scheduled_date: form.scheduled_date || null,
    };

    if (!isUsingSamples) {
      createBookingMut.mutate(job);
    } else {
      setLocalJobs(prev => [...(prev ?? baseJobs), { ...job, id: `local-${Date.now()}` }]);
    }
    setShowNewJob(false);
  }, [isUsingSamples, createBookingMut, baseJobs, driverRoster]);

  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div style={{ background: D.bg, minHeight: '100vh', padding: isMobile ? '16px 12px' : '20px 24px', fontFamily: fontBody, color: D.text }}>

      {/* ── Top bar ── */}
      <div style={{ marginBottom: 20 }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: fontHead, fontSize: isMobile ? 20 : 26, fontWeight: 700, color: D.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Dispatch Board
            </div>
            <div style={{ fontSize: isMobile ? 11 : 13, color: D.textMuted, marginTop: 3 }}>{today}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowLiveMap(prev => !prev)}
              data-testid="dispatch-live-map-toggle"
              aria-pressed={showLiveMap}
              style={{ background: showLiveMap ? D.card : 'none', color: showLiveMap ? D.accent : D.textSub, border: `1px solid ${showLiveMap ? D.accent : D.border}`, borderRadius: 8, padding: isMobile ? '10px 16px' : '10px 22px', cursor: 'pointer', fontFamily: fontHead, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}
            >
              🗺 Live Map
            </button>
            <button
              onClick={() => setShowNewJob(true)}
              style={{ background: D.accent, color: '#0A0A0A', border: 'none', borderRadius: 8, padding: isMobile ? '10px 16px' : '10px 22px', cursor: 'pointer', fontFamily: fontHead, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}
            >
              + New Job
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          {[
            { label: 'Total Jobs',        value: stats.total,                                          color: D.text },
            { label: 'Pending',           value: stats.pending,                                        color: '#F59E0B' },
            { label: 'In Progress',       value: stats.inProgress,                                     color: '#8B5CF6' },
            { label: 'Completed',         value: stats.completed,                                      color: '#10B981' },
            { label: 'Pipeline Value',    value: `$${Math.round(stats.pipeline).toLocaleString('en-AU')}`, color: D.accent },
          ].map((s, i) => (
            <div key={i} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 8, padding: '10px 16px', flex: '1 1 110px', minWidth: 100 }}>
              <div style={{ fontSize: 10, color: D.textMuted, textTransform: 'uppercase', fontFamily: fontHead, letterSpacing: '0.06em' }}>{s.label}</div>
              <div style={{ fontFamily: fontHead, fontWeight: 700, fontSize: 20, color: s.color, marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters + status row */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: D.textMuted, fontFamily: fontHead, textTransform: 'uppercase' }}>Driver:</span>
            <select
              data-testid="driver-filter-select"
              value={filterDriver}
              onChange={e => setFilterDriver(e.target.value)}
              style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 6, padding: '6px 10px', color: D.text, fontSize: 12, fontFamily: fontBody, cursor: 'pointer', outline: 'none', minHeight: 32 }}
            >
              <option value="">All Drivers</option>
              {hasRoster ? (
                <>
                  <option value="unassigned">⚠ Unassigned only ({filterJobCount('unassigned')})</option>
                  {driverRoster.map(d => (
                    <option key={d.id} value={`d:${d.id}`}>
                      {d.full_name || d.id} ({filterJobCount(`d:${d.id}`)} job{filterJobCount(`d:${d.id}`) === 1 ? '' : 's'})
                    </option>
                  ))}
                  {legacyNames.map(n => (
                    <option key={`legacy-${n}`} value={`legacy:${n}`}>Legacy: {n}</option>
                  ))}
                </>
              ) : (
                // Empty roster → original derived-from-jobs behaviour
                derivedNames.map(d => <option key={d} value={d}>{d}</option>)
              )}
            </select>
          </div>
          {filterDriver && (
            <button onClick={() => setFilterDriver('')} style={{ background: 'none', border: `1px solid ${D.border}`, borderRadius: 6, padding: '5px 10px', color: D.textMuted, fontSize: 11, cursor: 'pointer' }}>
              Clear
            </button>
          )}
          <label
            title="Show revenue / cost-so-far / margin inside each expanded job card. PRD-v6 §1: live job costing per job."
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: D.textMuted, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer', userSelect: 'none' }}
          >
            <input
              type="checkbox"
              checked={showJobCosting}
              onChange={e => setShowJobCosting(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: D.accent }}
            />
            Show job costing on cards
          </label>
          {isLoading && <span style={{ fontSize: 11, color: D.textMuted }}>Loading jobs…</span>}
          {isError && <span style={{ fontSize: 11, color: '#C96B6B' }}>⚠ Could not load from database — showing sample data</span>}
          {!isLoading && isUsingSamples && !isError && (
            <span style={{ fontSize: 11, color: D.textMuted, fontStyle: 'italic' }}>
              Showing sample data — add the bookings table to get started
            </span>
          )}
        </div>
      </div>

      {/* ── Live map (WP-C, R3) — lazy-mounted; polling stops when hidden ── */}
      {showLiveMap && (
        <div style={{ marginBottom: 20 }}>
          <React.Suspense fallback={
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 10, padding: 32, textAlign: 'center', color: D.textMuted, fontSize: 13 }}>
              Loading map…
            </div>
          }>
            <LiveMapPanel
              bookings={isUsingSamples ? undefined : filteredJobs}
              onSelectBooking={(id) => setExpandedId(id)}
            />
          </React.Suspense>
        </div>
      )}

      {/* ── Kanban board ── */}
      {isMobile && (
        <div style={{ fontSize: 11, color: D.textMuted, marginBottom: 8, fontStyle: 'italic' }}>← Swipe to see all columns →</div>
      )}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 24, WebkitOverflowScrolling: 'touch' }}>
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              column={col}
              jobs={columnJobs[col.id]}
              expandedId={expandedId}
              onExpand={handleExpand}
              showJobCosting={showJobCosting}
              driverRoster={driverRoster}
              truckRoster={truckRoster}
              rosterLoading={rosterLoading}
              isUsingSamples={isUsingSamples}
              onAssign={handleAssign}
            />
          ))}
        </div>
      </DragDropContext>

      {/* ── New Job modal ── */}
      {showNewJob && (
        <NewJobModal
          onSubmit={handleNewJobSubmit}
          onClose={() => setShowNewJob(false)}
          driverRoster={driverRoster}
          truckRoster={truckRoster}
          rosterLoading={rosterLoading}
          isUsingSamples={isUsingSamples}
        />
      )}
    </div>
  );
}
