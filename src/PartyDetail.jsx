import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import supabase from './supabaseClient';

function PartyDetail() {
  const { partyName } = useParams();
  const [partySubmissions, setPartySubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPartyData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('stock_submissions')
        .select('*')
        .eq('party', decodeURIComponent(partyName))
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Failed to load party data');
        console.error(error);
      } else {
        setPartySubmissions(data || []);
      }
      setLoading(false);
    };

    fetchPartyData();
  }, [partyName]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Toaster position="top-right" />

      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {decodeURIComponent(partyName)}
          </h1>
          <Link to="/dashboard" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            Back to Dashboard
          </Link>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl shadow border">
            <h3 className="text-lg font-semibold text-gray-600">Total Updates</h3>
            <p className="text-4xl font-bold text-indigo-700">{partySubmissions.length}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow border">
            <h3 className="text-lg font-semibold text-gray-600">Pending</h3>
            <p className="text-4xl font-bold text-yellow-700">
              {partySubmissions.filter(s => s.status === 'pending' || !s.status).length}
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow border">
            <h3 className="text-lg font-semibold text-gray-600">Delivered</h3>
            <p className="text-4xl font-bold text-green-700">
              {partySubmissions.filter(s => s.status === 'delivered').length}
            </p>
          </div>
        </div>

        {/* Submissions Table */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">All Updates for this Party</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Product</th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Current Stock</th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Order Qty</th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Photo Proof</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Date</th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {partySubmissions.map(sub => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">{sub.product_name}</td>
                    <td className="px-6 py-4 text-center">{sub.current_qty}</td>
                    <td className="px-6 py-4 text-center">{sub.order_qty}</td>
                    <td className="px-6 py-4 text-center">
                      {sub.photo_url && sub.photo_url !== '(No Photo)' && sub.photo_url !== '(Upload failed)' ? (
                        <a href={sub.photo_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                          View Photo
                        </a>
                      ) : (
                        <span className="text-gray-500">{sub.photo_url}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(sub.created_at).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                        sub.status === 'delivered' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {sub.status || 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
                {partySubmissions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No updates found for this party
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PartyDetail;