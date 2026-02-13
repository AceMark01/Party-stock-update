// src/ReviewForm.jsx - Fixed Approval + Delete with Timestamp in deleted_at

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Edit, Trash2, CheckCircle, Loader2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import supabase from './supabaseClient';

function ReviewForm() {
  const [searchParams] = useSearchParams();
  const uniqueKey = searchParams.get('key') || null;
  const party = searchParams.get('party') || 'Unknown Party';

  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [approvedSubmissions, setApprovedSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingRows, setEditingRows] = useState({});

  useEffect(() => {
    const loadSubmissions = async () => {
      if (!uniqueKey) {
        toast.error('Invalid link – unique key missing');
        setLoading(false);
        return;
      }

      const { data: pendingData, error: pendingError } = await supabase
        .from('stock_submissions')
        .select('*')
        .eq('unique_key', uniqueKey)
        .eq('party', party)
        .eq('approval_status', 'Pending');

      const { data: approvedData, error: approvedError } = await supabase
        .from('stock_submissions')
        .select('*')
        .eq('unique_key', uniqueKey)
        .eq('party', party)
        .or('approval_status.eq.Approved,approval_status.eq.Deleted');

      if (pendingError || approvedError) {
        toast.error('Data load nahi hua');
        console.error(pendingError || approvedError);
      } else {
        setPendingSubmissions(pendingData || []);
        setApprovedSubmissions(approvedData || []);
      }
      setLoading(false);
    };

    loadSubmissions();
  }, [uniqueKey, party]);

  const toggleEdit = (rowId) => {
    setEditingRows(prev => ({ ...prev, [rowId]: !prev[rowId] }));
  };

  const updateOrderQty = (rowId, newQty) => {
    setPendingSubmissions(prev => prev.map(s => 
      s.id === rowId ? { ...s, order_qty: Number(newQty) || 0 } : s
    ));
  };

  const deleteRow = async (row) => {
    if (!window.confirm(`Are you sure you want to delete "${row.product_name}"?`)) return;

    try {
      // 1. Delete the original pending row
      const { error: deleteError } = await supabase
        .from('stock_submissions')
        .delete()
        .eq('id', row.id);

      if (deleteError) throw deleteError;

      // 2. Insert audit record with 'Deleted' status + timestamp in deleted_at
      const { error: insertError } = await supabase
        .from('stock_submissions')
        .insert({
          ...row,                        // copy all original fields
          id: undefined,                 // new ID from DB
          approval_status: 'Deleted',
          deleted_at: new Date().toISOString(),  // ← Delete timestamp here
          order_qty: row.order_qty || 0,
          current_qty: row.current_qty || 0,
          photo_url: row.photo_url || '(No Photo)',
          action_status: row.action_status || '',
        });

      if (insertError) throw insertError;

      // 3. Remove from UI
      setPendingSubmissions(prev => prev.filter(s => s.id !== row.id));

      toast.success(`"${row.product_name}" deleted & logged successfully`);

    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Delete failed: ' + (err.message || 'Unknown error'));
    }
  };

  const approveChanges = async () => {
    setSaving(true);

    try {
      const updates = pendingSubmissions.map(s => ({
        id: s.id,
        party: s.party,
        product_name: s.product_name,
        current_qty: s.current_qty || 0,
        order_qty: s.order_qty,
        photo_url: s.photo_url || '(No Photo)',
        unique_key: s.unique_key,
        action_status: s.action_status || '',
        approval_status: 'Approved',
        deleted_at: new Date().toISOString()   // ← Approval timestamp here (reusing deleted_at)
      }));

      console.log('Approving these rows:', updates);

      const { error } = await supabase
        .from('stock_submissions')
        .upsert(updates, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (error) throw error;

      toast.success('All changes approved & timestamped!');
      setPendingSubmissions([]);
      setApprovedSubmissions([...approvedSubmissions, ...pendingSubmissions.map(s => ({ ...s, approval_status: 'Approved' }))]);
    } catch (err) {
      console.error('Approve failed:', err);
      toast.error(`Approval failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (pendingSubmissions.length === 0 && approvedSubmissions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        No data found for this link.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white p-4 sm:p-8">
      <Toaster />

      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-indigo-600 p-6 text-white text-center">
          <h1 className="text-2xl font-bold">Review & Approve for {party}</h1>
          <p className="mt-2 text-indigo-100">Batch Key: {uniqueKey?.substring(0, 8)}...</p>
        </div>

        {pendingSubmissions.length > 0 && (
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold mb-4">Pending Items ({pendingSubmissions.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-3">Product</th>
                    <th className="p-3">Current Qty</th>
                    <th className="p-3">Order Qty</th>
                    <th className="p-3">Photo</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingSubmissions.map(s => {
                    const isEditing = editingRows[s.id] || false;

                    return (
                      <tr key={s.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{s.product_name}</td>
                        <td className="p-3">{s.current_qty}</td>
                        <td className="p-3">
                          {isEditing ? (
                            <input
                              type="number"
                              defaultValue={s.order_qty}
                              onChange={(e) => updateOrderQty(s.id, e.target.value)}
                              className="w-24 p-1 border rounded text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          ) : (
                            s.order_qty
                          )}
                        </td>
                        <td className="p-3">
                          {s.photo_url && s.photo_url !== '(No Photo)' ? (
                            <a 
                              href={s.photo_url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-indigo-600 hover:underline hover:text-indigo-800"
                            >
                              View Photo
                            </a>
                          ) : 'No Photo'}
                        </td>
                        <td className="p-3 flex gap-4">
                          <button 
                            onClick={() => toggleEdit(s.id)} 
                            className="text-blue-600 hover:text-blue-800 transition"
                          >
                            <Edit size={20} />
                          </button>
                          <button 
                            onClick={() => deleteRow(s)} 
                            className="text-red-600 hover:text-red-800 transition"
                          >
                            <Trash2 size={20} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {approvedSubmissions.length > 0 && (
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Approved / Deleted Items ({approvedSubmissions.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-3">Product</th>
                    <th className="p-3">Current Qty</th>
                    <th className="p-3">Order Qty</th>
                    <th className="p-3">Photo</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedSubmissions.map(s => (
                    <tr key={s.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{s.product_name}</td>
                      <td className="p-3">{s.current_qty}</td>
                      <td className="p-3">{s.order_qty}</td>
                      <td className="p-3">
                        {s.photo_url && s.photo_url !== '(No Photo)' ? (
                          <a 
                            href={s.photo_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-indigo-600 hover:underline hover:text-indigo-800"
                          >
                            View Photo
                          </a>
                        ) : 'No Photo'}
                      </td>
                      <td className="p-3">
                        <span className={`font-medium ${s.approval_status === 'Approved' ? 'text-green-600' : 'text-red-600'}`}>
                          {s.approval_status}
                          {s.deleted_at && ` (${new Date(s.deleted_at).toLocaleString('en-IN')})`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {pendingSubmissions.length > 0 && (
          <div className="p-6 border-t flex justify-end">
            <button
              onClick={approveChanges}
              disabled={saving}
              className="flex items-center gap-2 px-8 py-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Approve All Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReviewForm;