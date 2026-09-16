/**
 * NGO Dashboard — main portal for NGO users.
 * Shows own profile, capacity status, verification badge, and quick actions.
 */

import { Link } from 'react-router-dom';
import { Weight, Clock, CheckCircle, XCircle, Package, Settings, ArrowRight, ShieldAlert } from 'lucide-react';
import { useMyNGOProfile } from '../../hooks/useNGO';
import { AppLayout } from '../../components/layout/AppLayout';

export function NGODashboard() {
  const { data: profile, isLoading, error } = useMyNGOProfile();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <div className="skeleton h-8 w-56" />
          <div className="skeleton h-48 w-full" />
          <div className="skeleton h-32 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (error || !profile) {
    return (
      <AppLayout>
        <div className="panel p-12 text-center">
          <p className="text-red-500 font-medium">Failed to load NGO profile. Please refresh.</p>
        </div>
      </AppLayout>
    );
  }

  const capacityUsedPct = profile.storage_capacity_kg > 0
    ? ((profile.storage_capacity_kg - profile.available_capacity_kg) / profile.storage_capacity_kg) * 100
    : 0;

  const isVerified = profile.verification_status === 'APPROVED';
  const isPending = profile.verification_status === 'PENDING';

  return (
    <AppLayout>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{profile.organisation_name}</h1>
          <p className="page-subtitle">{profile.address}</p>
        </div>
        <div className="flex items-center gap-3">
          {isVerified && <span className="badge-green"><CheckCircle size={12} /> Verified</span>}
          {isPending && <span className="badge-yellow"><Clock size={12} /> Verification Pending</span>}
          {!isVerified && !isPending && <span className="badge-red"><XCircle size={12} /> Not Verified</span>}
        </div>
      </div>

      {/* Pending verification notice */}
      {isPending && (
        <div className="mb-6 p-4 rounded-sm border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
          <ShieldAlert size={20} className="text-amber-500 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-500">Verification Pending</p>
            <p className="text-xs text-amber-500/80 mt-1">
              Your NGO is awaiting admin review. You can still view your profile and incoming offers.
            </p>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Storage Capacity', value: `${profile.storage_capacity_kg} kg`, icon: <Weight size={16} />, color: 'text-emerald-400' },
          { label: 'Available Now', value: `${profile.available_capacity_kg} kg`, icon: <Package size={16} />, color: 'text-blue-400' },
          { label: 'Categories Accepted', value: profile.accepted_categories.length, icon: <CheckCircle size={16} />, color: 'text-amber-400' },
          { label: 'Demand Entries', value: profile.demand.length, icon: <ArrowRight size={16} />, color: 'text-zinc-100' },
        ].map((s) => (
          <div key={s.label} className="panel flex flex-col justify-between p-5">
            <div className="flex items-center gap-1.5 text-zinc-500 mb-3">
              {s.icon}
              <span className="text-xs font-medium uppercase tracking-wide">{s.label}</span>
            </div>
            <p className={`text-2xl font-semibold tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Capacity & categories */}
        <div className="lg:col-span-2 space-y-6">
          {/* Capacity bar */}
          <div className="panel">
            <div className="flex items-center justify-between mb-6">
              <h3 className="section-title mb-0"><Weight size={16} className="text-zinc-400" /> Storage Capacity</h3>
              <Link to="/ngo/settings" className="text-xs text-emerald-500 font-medium hover:underline">Update</Link>
            </div>
            <div className="flex justify-between text-sm mb-2 font-medium">
              <span className="text-zinc-100 tabular-nums">
                {profile.available_capacity_kg} kg available
              </span>
              <span className="text-zinc-500 tabular-nums">
                {profile.storage_capacity_kg} kg total
              </span>
            </div>
            <div className="capacity-bar">
              <div
                className={`capacity-fill ${capacityUsedPct > 90 ? 'critical' : capacityUsedPct > 70 ? 'warning' : ''}`}
                style={{ width: `${Math.min(capacityUsedPct, 100)}%` }}
              />
            </div>
            <p className="text-xs mt-2 text-zinc-500 tabular-nums">
              {capacityUsedPct.toFixed(0)}% occupied
            </p>
          </div>

          {/* Accepted food categories */}
          <div className="panel">
            <div className="flex items-center justify-between mb-6">
              <h3 className="section-title mb-0"><Package size={16} className="text-zinc-400" /> Accepted Categories</h3>
              <Link to="/ngo/settings" className="text-xs text-emerald-500 font-medium hover:underline">Edit</Link>
            </div>
            {profile.accepted_categories.length === 0 ? (
              <p className="text-sm text-zinc-500">No food categories configured. Set preferences in Settings.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profile.accepted_categories.map((cat) => (
                  <span key={cat} className="badge-gray px-2 py-1 text-xs">
                    {cat.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Current demand */}
          <div className="panel">
            <div className="flex items-center justify-between mb-6">
              <h3 className="section-title mb-0"><ArrowRight size={16} className="text-zinc-400" /> Current Demand</h3>
              <Link to="/ngo/settings" className="text-xs text-emerald-500 font-medium hover:underline">Add</Link>
            </div>
            {profile.demand.length === 0 ? (
              <p className="text-sm text-zinc-500">No demand entries. Add them in Settings to improve matching.</p>
            ) : (
              <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-sm">
                {profile.demand.map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-zinc-950">
                    <div>
                      <p className="text-sm font-semibold text-zinc-100 mb-1">
                        {d.food_category.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-zinc-500 tabular-nums">
                        Priority {d.priority} • Valid until {new Date(d.valid_until).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="badge-blue tabular-nums">{d.required_quantity_kg} kg</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — Quick actions & hours */}
        <div className="space-y-6">
          {/* Quick actions */}
          <div className="panel">
            <h3 className="section-title"><ArrowRight size={16} className="text-zinc-400" /> Quick Actions</h3>
            <div className="space-y-3">
              {[
                { label: 'View Incoming Offers', href: '/ngo/incoming', icon: <Package size={16} />, desc: 'Review matched donations' },
                { label: 'Update Settings', href: '/ngo/settings', icon: <Settings size={16} />, desc: 'Capacity, demand & profile' },
              ].map((a) => (
                <Link key={a.href} to={a.href}
                  className="flex items-start gap-3 p-4 bg-zinc-950 border border-zinc-800 rounded-sm hover:bg-zinc-800 transition-colors">
                  <div className="mt-0.5 text-zinc-400">
                    {a.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-100 mb-0.5">{a.label}</p>
                    <p className="text-xs text-zinc-500">{a.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Operating hours */}
          <div className="panel">
            <h3 className="section-title"><Clock size={16} className="text-zinc-400" /> Operating Hours</h3>
            <div className="flex items-center gap-3 p-4 bg-zinc-950 border border-zinc-800 rounded-sm">
              <div className="flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1">Opens</p>
                <p className="text-lg font-semibold tabular-nums text-zinc-100">{profile.operating_hours.start}</p>
              </div>
              <div className="text-zinc-600">—</div>
              <div className="flex-1 text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1">Closes</p>
                <p className="text-lg font-semibold tabular-nums text-zinc-100">{profile.operating_hours.end}</p>
              </div>
            </div>
            <Link to="/ngo/settings" className="text-xs mt-4 block text-center text-emerald-500 hover:underline">
              Edit hours
            </Link>
          </div>

          {/* NGO ID */}
          <div className="panel p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1">NGO ID</p>
            <p className="text-xs font-mono text-zinc-400 break-all">
              {profile.ngo_id}
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
