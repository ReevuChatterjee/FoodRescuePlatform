import { FormEvent, useEffect, useState } from 'react';
import { AlertCircle, Pencil, Trash2, X } from 'lucide-react';
import { DEMAND_PRIORITIES, useDeleteDemand, useIncomingDonations, useMyNGO, useNGOCategories, useNGODemands, useOfferDecision, useSaveCategories, useSaveDemand, useSaveNGO } from '../../hooks/useNGO';
import type { DemandPriority, NGODemand, NGOProfile } from '../../types/api';

type ProfileForm = Omit<NGOProfile, 'id' | 'verification_status' | 'created_at'>;
const blankProfile: ProfileForm = { organisation_name: '', address: '', location: '', storage_capacity_kg: 0, available_capacity_kg: 0, operating_start: '09:00', operating_end: '18:00' };
const blankDemand = { food_category: '', required_quantity_kg: 1, priority: 'MEDIUM' as DemandPriority, valid_until: '' };

export function NGODashboard() {
  const { data: ngo, isLoading, error } = useMyNGO();
  const saveNGO = useSaveNGO();
  const [profile, setProfile] = useState<ProfileForm>(blankProfile);
  const [categoryInput, setCategoryInput] = useState('');
  const [editingDemand, setEditingDemand] = useState<NGODemand | null>(null);
  const [demand, setDemand] = useState(blankDemand);
  const { data: categories = [] } = useNGOCategories(ngo?.id);
  const saveCategories = useSaveCategories(ngo?.id);
  const { data: demands = [] } = useNGODemands(ngo?.id);
  const saveDemand = useSaveDemand(ngo?.id);
  const deleteDemand = useDeleteDemand(ngo?.id);
  const { data: offers = [] } = useIncomingDonations(ngo?.id);
  const offerDecision = useOfferDecision(ngo?.id);

  useEffect(() => { if (ngo) setProfile(({ ...ngo })); }, [ngo]);

  const submitProfile = (event: FormEvent) => {
    event.preventDefault();
    if (profile.available_capacity_kg > profile.storage_capacity_kg) return;
    saveNGO.mutate({ id: ngo?.id, profile });
  };
  const submitDemand = (event: FormEvent) => {
    event.preventDefault();
    saveDemand.mutate({ id: editingDemand?.id, demand }, { onSuccess: () => { setDemand(blankDemand); setEditingDemand(null); } });
  };
  const addCategory = () => {
    const category = categoryInput.trim();
    if (category && !categories.includes(category)) saveCategories.mutate([...categories, category]);
    setCategoryInput('');
  };
  const removeCategory = (category: string) => saveCategories.mutate(categories.filter((item) => item !== category));
  const editDemand = (item: NGODemand) => { setEditingDemand(item); setDemand({ food_category: item.food_category, required_quantity_kg: item.required_quantity_kg, priority: item.priority, valid_until: item.valid_until.slice(0, 16) }); };

  if (isLoading) return <div className="p-8">Loading NGO workspace…</div>;
  if (error) return <div className="p-8 text-red-700">Unable to load your NGO profile.</div>;
  const isCapacityInvalid = profile.available_capacity_kg > profile.storage_capacity_kg;

  return <main className="min-h-screen bg-slate-50 p-6 md:p-10"><div className="mx-auto max-w-6xl space-y-6">
    <header><p className="text-sm font-semibold text-emerald-700">NGO WORKSPACE</p><h1 className="text-3xl font-bold text-slate-900">{ngo?.organisation_name || 'Set up your NGO profile'}</h1><p className="mt-1 text-slate-600">Manage intake capacity, food needs, and matched donation offers.</p></header>
    <section className="grid gap-6 lg:grid-cols-3"><form onSubmit={submitProfile} className="rounded-xl bg-white p-5 shadow-sm lg:col-span-2"><h2 className="text-lg font-bold">Profile and capacity</h2><div className="mt-4 grid gap-3 md:grid-cols-2">
      {(['organisation_name', 'address', 'location', 'operating_start', 'operating_end'] as const).map((field) => <label key={field} className="text-sm font-medium capitalize">{field.replace(/_/g, ' ')}<input required value={profile[field]} type={field.startsWith('operating') ? 'time' : 'text'} onChange={(event) => setProfile({ ...profile, [field]: event.target.value })} className="mt-1 w-full rounded border p-2" /></label>)}
      <label className="text-sm font-medium">Total storage (kg)<input required min="0" step="0.1" type="number" value={profile.storage_capacity_kg} onChange={(event) => setProfile({ ...profile, storage_capacity_kg: Number(event.target.value) })} className="mt-1 w-full rounded border p-2" /></label>
      <label className="text-sm font-medium">Available capacity (kg)<input required min="0" max={profile.storage_capacity_kg} step="0.1" type="number" value={profile.available_capacity_kg} onChange={(event) => setProfile({ ...profile, available_capacity_kg: Number(event.target.value) })} className="mt-1 w-full rounded border p-2" /></label>
    </div>{isCapacityInvalid && <p className="mt-3 flex gap-2 text-sm text-red-700"><AlertCircle size={16} />Available capacity cannot exceed total storage.</p>}<button disabled={isCapacityInvalid || saveNGO.isPending} className="mt-4 rounded bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{ngo ? 'Save profile' : 'Create profile'}</button></form>
      <aside className="rounded-xl bg-emerald-700 p-5 text-white"><p className="text-sm font-semibold">AVAILABLE CAPACITY</p><p className="mt-3 text-4xl font-bold">{profile.available_capacity_kg} <span className="text-lg">kg</span></p><p className="mt-1 text-emerald-100">of {profile.storage_capacity_kg} kg storage</p><p className="mt-6 text-sm">Verification: <strong>{ngo?.verification_status || 'PENDING'}</strong></p></aside></section>
    {ngo && <><section className="rounded-xl bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Accepted food categories</h2><div className="mt-3 flex gap-2"><input value={categoryInput} onChange={(event) => setCategoryInput(event.target.value)} className="rounded border p-2" placeholder="Food category" /><button type="button" onClick={addCategory} className="rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Add</button></div><div className="mt-3 flex flex-wrap gap-2">{categories.map((category) => <span key={category} className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{category}<button type="button" onClick={() => removeCategory(category)} aria-label={`Remove ${category}`} className="ml-2"><X className="inline" size={14} /></button></span>)}</div></section>
    <section className="grid gap-6 lg:grid-cols-2"><div className="rounded-xl bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Current demand</h2><form onSubmit={submitDemand} className="mt-3 grid gap-3 md:grid-cols-2"><input required value={demand.food_category} onChange={(event) => setDemand({ ...demand, food_category: event.target.value })} className="rounded border p-2" placeholder="Food category" /><input required min="0.1" step="0.1" type="number" value={demand.required_quantity_kg} onChange={(event) => setDemand({ ...demand, required_quantity_kg: Number(event.target.value) })} className="rounded border p-2" aria-label="Required kilograms" /><select value={demand.priority} onChange={(event) => setDemand({ ...demand, priority: event.target.value as DemandPriority })} className="rounded border p-2">{DEMAND_PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select><input required type="datetime-local" value={demand.valid_until} onChange={(event) => setDemand({ ...demand, valid_until: event.target.value })} className="rounded border p-2" /><button className="rounded bg-emerald-700 px-3 py-2 font-semibold text-white">{editingDemand ? 'Update demand' : 'Add demand'}</button>{editingDemand && <button type="button" onClick={() => { setEditingDemand(null); setDemand(blankDemand); }} className="rounded border px-3 py-2">Cancel</button>}</form><ul className="mt-5 divide-y">{demands.map((item) => <li key={item.id} className="flex items-center justify-between py-3"><span><strong>{item.food_category}</strong> · {item.required_quantity_kg} kg · {item.priority}</span><span className="flex gap-2"><button aria-label="Edit demand" onClick={() => editDemand(item)}><Pencil size={16} /></button><button aria-label="Delete demand" onClick={() => deleteDemand.mutate(item.id)}><Trash2 size={16} /></button></span></li>)}</ul></div>
      <div className="rounded-xl bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Matched donation offers</h2><div className="mt-3 space-y-3">{offers.length === 0 && <p className="text-sm text-slate-500">No matched donations are awaiting your decision.</p>}{offers.map((offer) => <article key={offer.id} className="rounded border p-4"><div className="flex justify-between gap-3"><div><h3 className="font-bold">{offer.food_name}</h3><p className="text-sm text-slate-600">{offer.food_category} · {offer.quantity_kg} kg · expires {new Date(offer.expiry_time).toLocaleString()}</p><p className="mt-1 text-sm text-slate-600">Pickup: {offer.pickup_location}</p>{offer.special_requirements && <p className="mt-1 text-sm text-slate-600">{offer.special_requirements}</p>}</div></div><div className="mt-3 flex gap-2"><button onClick={() => offerDecision.mutate({ donationId: offer.id, decision: 'accept' })} className="rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Accept</button><button onClick={() => offerDecision.mutate({ donationId: offer.id, decision: 'reject' })} className="rounded border border-red-300 px-3 py-2 text-sm font-semibold text-red-700"><X className="mr-1 inline" size={14} />Reject</button></div></article>)}</div></div></section></>}
  </div></main>;
}
