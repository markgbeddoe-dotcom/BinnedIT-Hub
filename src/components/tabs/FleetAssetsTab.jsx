import React, { useState } from 'react';
import { B, fontHead, fmtFull } from '../../theme';
import { SectionHeader, KPITile } from '../UIComponents';
import { useFleetAssets, useUpcomingMaintenance, useAddMaintenanceRecord } from '../../hooks/useFleet';
import { useBreakpoint } from '../../hooks/useBreakpoint';

const ASSET_TYPES = ['truck', 'bin', 'trailer', 'equipment'];
const MAINT_TYPES = ['service', 'repair', 'inspection', 'registration', 'other'];

// Fallback data when Supabase fleet_assets table is empty/unavailable
const FALLBACK_ASSETS = [
  { id: '1', asset_type: 'truck', identifier: 'TRK-001', description: 'Mack Truck — Primary Hook Lift', registration: 'ABC123', rego_expiry: '2026-06-30', year_of_manufacture: 2018, is_active: true, notes: '' },
  { id: '2', asset_type: 'truck', identifier: 'TRK-002', description: 'Isuzu — Secondary Truck', registration: 'XYZ456', rego_expiry: '2026-05-15', year_of_manufacture: 2020, is_active: true, notes: '' },
  { id: '3', asset_type: 'bin', identifier: 'BIN-4M-001', description: '4m³ General Waste Bin', registration: null, rego_expiry: null, year_of_manufacture: 2019, is_active: true, notes: '' },
  { id: '4', asset_type: 'bin', identifier: 'BIN-6M-001', description: '6m³ General Waste Bin', registration: null, rego_expiry: null, year_of_manufacture: 2020, is_active: true, notes: '' },
  { id: '5', asset_type: 'bin', identifier: 'BIN-8M-ASB', description: '8m³ Asbestos Bin', registration: null, rego_expiry: null, year_of_manufacture: 2021, is_active: true, notes: 'Licensed for asbestos only' },
];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
}

function StatusBadge({ days }) {
  if (days === null) return null;
  if (days <= 0) return <span style={{ fontSize: 10, background: `${B.red}20`, color: B.red, padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>OVERDUE</span>;
  if (days <= 30) return <span style={{ fontSize: 10, background: `${B.amber}20`, color: B.amber, padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>DUE {days}d</span>;
  if (days <= 90) return <span style={{ fontSize: 10, background: `${B.yellow}20`, color: B.yellow, padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>DUE {days}d</span>;
  return <span style={{ fontSize: 10, background: `${B.green}20`, color: B.green, padding: '2px 8px', borderRadius: 4 }}>OK</span>;
}

export default function FleetAssetsTab() {
  const { isMobile } = useBreakpoint();
  const { data: assets, isLoading, isError } = useFleetAssets();
  const { data: upcomingMaint } = useUpcomingMaintenance();
  const addMaint = useAddMaintenanceRecord();

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showAddMaint, setShowAddMaint] = useState(false);
  const [maintForm, setMaintForm] = useState({
    maintenance_type: 'service',
    description: '',
    performed_date: new Date().toISOString().slice(0, 10),
    next_due_date: '',
    cost: '',
    odometer_km: '',
    performed_by: '',
    notes: '',
  });

  const useSupabase = assets && assets.length > 0;
  const displayAssets = useSupabase ? assets : FALLBACK_ASSETS;

  const trucks = displayAssets.filter(a => a.asset_type === 'truck');
  const bins = displayAssets.filter(a => a.asset_type === 'bin');
  const other = displayAssets.filter(a => !['truck', 'bin'].includes(a.asset_type));

  const handleAddMaint = () => {
    if (!selectedAsset || !maintForm.performed_date || !maintForm.maintenance_type) return;
    addMaint.mutate({
      asset_id: selectedAsset.id,
      ...maintForm,
      cost: maintForm.cost ? parseFloat(maintForm.cost) : null,
      odometer_km: maintForm.odometer_km ? parseInt(maintForm.odometer_km) : null,
    });
    setShowAddMaint(false);
    setMaintForm({
      maintenance_type: 'service',
      description: '',
      performed_date: new Date().toISOString().slice(0, 10),
      next_due_date: '',
      cost: '',
      odometer_km: '',
      performed_by: '',
      notes: '',
    });
  };

  const iStyle = {
    background: B.bg, border: `1px solid ${B.cardBorder}`, borderRadius: 6,
    padding: '6px 10px', fontSize: 12, color: B.textPrimary, outline: 'none',
    fontFamily: 'DM Sans, sans-serif',
  };

  const AssetCard = ({ asset }) => {
    const regoDays = daysUntil(asset.rego_expiry);
    return (
      <div
        style={{
          background: B.cardBg, border: `1px solid ${B.cardBorder}`,
          borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
          borderLeft: `4px solid ${asset.asset_type === 'truck' ? B.yellow : asset.asset_type === 'bin' ? B.green : B.amber}`,
          transition: 'all 0.15s',
        }}
        onClick={() => setSelectedAsset(selectedAsset?.id === asset.id ? null : asset)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: fontHead, fontSize: 13, fontWeight: 700, color: B.textPrimary }}>{asset.identifier}</div>
            <div style={{ fontSize: 12, color: B.textSecondary, marginTop: 2 }}>{asset.description}</div>
            {asset.registration && <div style={{ fontSize: 11, color: B.textMuted, marginTop: 2 }}>Rego: {asset.registration}</div>}
          </div>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, color: B.textMuted, textTransform: 'uppercase', fontFamily: fontHead }}>{asset.asset_type}</span>
            {asset.year_of_manufacture && <span style={{ fontSize: 10, color: B.textMuted }}>{asset.year_of_manufacture}</span>}
            {regoDays !== null && <StatusBadge days={regoDays} />}
          </div>
        </div>
        {selectedAsset?.id === asset.id && (
          <div style={{ marginTop: 14, borderTop: `1px solid ${B.cardBorder}`, paddingTop: 12 }}>
            {asset.notes && <div style={{ fontSize: 11, color: B.textSecondary, marginBottom: 8 }}>{asset.notes}</div>}
            {asset.rego_expiry && (
              <div style={{ fontSize: 11, color: B.textMuted, marginBottom: 8 }}>
                Rego expires: <strong>{new Date(asset.rego_expiry).toLocaleDateString('en-AU')}</strong>
                {regoDays !== null && ` (${regoDays > 0 ? `${regoDays} days` : 'EXPIRED'})`}
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setShowAddMaint(true); }}
              style={{
                background: B.yellow, color: '#000', border: 'none',
                borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
                fontFamily: fontHead, fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}
            >
              + Add Maintenance Record
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <SectionHeader title="Fleet Assets" subtitle="Trucks, bins, and equipment — maintenance tracking" />

      {isLoading && <div style={{ color: B.textMuted, fontSize: 13, padding: '12px 0' }}>Loading fleet assets...</div>}

      {(!useSupabase && !isLoading) && (
        <div style={{ background: `${B.yellow}10`, border: `1px solid ${B.yellow}30`, borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: B.textMuted }}>
          Showing sample fleet data — apply migrations to load actual assets
        </div>
      )}

      {/* KPI summary */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <KPITile label="Total Assets" value={displayAssets.length} status="yellow" />
        <KPITile label="Trucks" value={trucks.length} status="green" />
        <KPITile label="Bins" value={bins.length} status="amber" />
        <KPITile label="Upcoming Maintenance" value={upcomingMaint?.length || 0} status={upcomingMaint?.length > 0 ? 'red' : 'green'} />
      </div>

      {/* Upcoming maintenance alerts */}
      {upcomingMaint && upcomingMaint.length > 0 && (
        <div style={{ background: `${B.amber}10`, border: `1px solid ${B.amber}40`, borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontFamily: fontHead, fontSize: 12, fontWeight: 700, color: B.amber, textTransform: 'uppercase', marginBottom: 10 }}>
            Upcoming Maintenance (Next 30 Days)
          </div>
          {upcomingMaint.slice(0, 5).map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${B.cardBorder}`, fontSize: 12 }}>
              <div>
                <strong>{m.fleet_assets?.identifier || m.asset_id}</strong>{' '}
                <span style={{ color: B.textSecondary }}>— {m.maintenance_type} {m.description ? `(${m.description})` : ''}</span>
              </div>
              <div style={{ color: B.amber, fontWeight: 700 }}>
                Due: {new Date(m.next_due_date).toLocaleDateString('en-AU')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add maintenance modal */}
      {showAddMaint && selectedAsset && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowAddMaint(false)}>
          <div style={{ background: B.cardBg, borderRadius: 14, padding: 24, maxWidth: 500, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: fontHead, fontSize: 16, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase', marginBottom: 16 }}>
              Add Maintenance — {selectedAsset.identifier}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 10, color: B.textMuted, display: 'block', marginBottom: 4 }}>Type *</label>
                <select value={maintForm.maintenance_type} onChange={e => setMaintForm(p => ({ ...p, maintenance_type: e.target.value }))} style={{ ...iStyle, width: '100%' }}>
                  {MAINT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: B.textMuted, display: 'block', marginBottom: 4 }}>Performed Date *</label>
                <input type="date" value={maintForm.performed_date} onChange={e => setMaintForm(p => ({ ...p, performed_date: e.target.value }))} style={{ ...iStyle, width: '100%' }} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 10, color: B.textMuted, display: 'block', marginBottom: 4 }}>Description</label>
                <input value={maintForm.description} onChange={e => setMaintForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. 100,000km service" style={{ ...iStyle, width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: B.textMuted, display: 'block', marginBottom: 4 }}>Next Due Date</label>
                <input type="date" value={maintForm.next_due_date} onChange={e => setMaintForm(p => ({ ...p, next_due_date: e.target.value }))} style={{ ...iStyle, width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: B.textMuted, display: 'block', marginBottom: 4 }}>Cost ($)</label>
                <input type="number" value={maintForm.cost} onChange={e => setMaintForm(p => ({ ...p, cost: e.target.value }))} placeholder="0.00" style={{ ...iStyle, width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: B.textMuted, display: 'block', marginBottom: 4 }}>Odometer (km)</label>
                <input type="number" value={maintForm.odometer_km} onChange={e => setMaintForm(p => ({ ...p, odometer_km: e.target.value }))} placeholder="e.g. 98500" style={{ ...iStyle, width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: B.textMuted, display: 'block', marginBottom: 4 }}>Performed By</label>
                <input value={maintForm.performed_by} onChange={e => setMaintForm(p => ({ ...p, performed_by: e.target.value }))} placeholder="e.g. ABC Diesel" style={{ ...iStyle, width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={handleAddMaint} style={{ flex: 1, background: B.green, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', cursor: 'pointer', fontFamily: fontHead, fontSize: 13, fontWeight: 700 }}>
                {addMaint.isPending ? 'Saving...' : 'Save Record'}
              </button>
              <button onClick={() => setShowAddMaint(false)} style={{ background: 'none', border: `1px solid ${B.cardBorder}`, color: B.textSecondary, borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontFamily: fontHead, fontSize: 12 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset sections */}
      {[
        { label: 'Trucks', assets: trucks, color: B.yellow },
        { label: 'Bins', assets: bins, color: B.green },
        { label: 'Other Equipment', assets: other, color: B.amber },
      ].filter(s => s.assets.length > 0).map((section, si) => (
        <div key={si} style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: fontHead, fontSize: 13, fontWeight: 700, color: section.color, textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.06em' }}>
            {section.label} ({section.assets.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 10 }}>
            {section.assets.map((asset, ai) => (
              <AssetCard key={ai} asset={asset} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
