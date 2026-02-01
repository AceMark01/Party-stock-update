import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import supabase from './supabaseClient';

function App() {
  const [party, setParty] = useState('Unknown Party');
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('party') || 'Unknown Party';
    setParty(p);

    const loadItems = async () => {
      const { data, error } = await supabase
        .from('stock_items')
        .select('product_name, inv_amount')
        .eq('party', p);

      if (error) {
        console.error('Supabase load error:', error);
        toast.error('Items load nahi hue – Supabase connection check karo');
        return;
      }

      const map = {};
      data.forEach(r => {
        const name = (r.product_name || '').trim();
        if (!name) return;
        map[name] = (map[name] || 0) + (Number(r.inv_amount) || 0);
      });

      const formattedItems = Object.entries(map)
        .map(([name, sum]) => ({
          name,
          sum: Math.round(sum * 100) / 100
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setItems(formattedItems);
      setTotalItems(formattedItems.length);
    };

    loadItems();
  }, [party]);

  const toggleAll = (checked) => {
    document.querySelectorAll('.include-check').forEach(c => {
      c.checked = checked;
      toggleRow(c);
    });
  };

  const toggleRow = (checkbox) => {
    const row = checkbox.closest('tr');
    row.classList.toggle('opacity-35', !checkbox.checked);
    row.querySelectorAll('input:not(.include-check)').forEach(i => {
      i.disabled = !checkbox.checked;
    });
  };

  const showFile = (input) => {
    const file = input.files[0];
    if (file) {
      input.closest('td').querySelector('.file-name').textContent = `✔ ${file.name}`;
    } else {
      input.closest('td').querySelector('.file-name').textContent = '';
    }
  };

  const submitForm = async () => {
    setLoading(true);

    const submissions = [];
    const uploadPromises = [];
    let validationFailed = false;

    document.querySelectorAll('tr').forEach((row) => {
      const check = row.querySelector('.include-check');
      if (!check || !check.checked) return;

      const nameInput = row.querySelector('input[name^="name_"]');
      const currentInput = row.querySelector('input[name^="current_"]');
      const orderInput = row.querySelector('input[name^="order_"]');
      const photoInput = row.querySelector('input[type="file"]');

      const productName = nameInput?.value?.trim() || '';
      const current = currentInput?.value?.trim() || '';
      const order = orderInput?.value?.trim() || '';
      const hasPhoto = photoInput?.files?.length > 0;

      // Validation: All 3 fields must be filled
      if (!current || !order || !hasPhoto) {
        validationFailed = true;
        return; // stop processing this row
      }

      let photoPromise = Promise.resolve('(No Photo)');

      if (hasPhoto) {
        const file = photoInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${party.replace(/\s+/g, '_')}/${crypto.randomUUID()}.${fileExt}`;

        photoPromise = supabase.storage
          .from('stock-photos')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          })
          .then(({ data, error: uploadError }) => {
            if (uploadError) {
              console.error('Photo upload error:', uploadError);
              toast.error(`Photo upload fail: ${file.name}`);
              return '(Upload failed)';
            }

            const { data: urlData } = supabase.storage
              .from('stock-photos')
              .getPublicUrl(fileName);

            return urlData.publicUrl;
          })
          .catch(err => {
            console.error('Unexpected upload error:', err);
            return '(Upload failed)';
          });
      }

      uploadPromises.push(
        photoPromise.then(photoUrl => {
          submissions.push({
            party,
            product_name: productName,
            current_qty: Number(current) || 0,
            order_qty: Number(order) || 0,
            photo_url: photoUrl
          });
        })
      );
    });

    // Stop if validation failed
    if (validationFailed) {
      setLoading(false);
      toast.error('Har selected row mein Current Qty, Order Qty aur Photo fill karo!');
      return;
    }

    await Promise.all(uploadPromises);

    if (submissions.length === 0) {
      setLoading(false);
      toast.error('Koi row select nahi kiya');
      return;
    }

    const { error } = await supabase
      .from('stock_submissions')
      .insert(submissions);

    setLoading(false);

    if (error) {
      console.error('Insert error:', error);
      toast.error('Data save nahi hua – console check karo');
    } else {
      toast.success('Successfully Saved!');
      setTimeout(() => window.location.reload(), 2500);
    }
  };

  return (
    <div className="font-sans bg-linear-to-b from-slate-50 to-indigo-50 min-h-screen">
      <Toaster position="bottom-center" />

      {loading && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white px-8 py-6 rounded-xl text-center">
            <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <div className="font-semibold">Saving...</div>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-50 bg-linear-to-r from-indigo-600 to-violet-600 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div>
            <div className="text-xs opacity-80">Stock Update</div>
            <div className="text-lg font-bold">{party}</div>
            <div className="text-xs mt-1 opacity-90">
              Total Items: <span className="font-semibold">{totalItems}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => toggleAll(true)} className="px-3 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition">Enable</button>
            <button onClick={() => toggleAll(false)} className="px-3 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition">Disable</button>
            <button onClick={submitForm} className="px-4 py-2 bg-black/30 rounded-lg font-semibold hover:bg-black/40 transition">Submit</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 bg-white rounded-2xl shadow-xl mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-indigo-700">
              <th className="p-3">Select</th>
              <th className="p-3 text-left">Product</th>
              <th className="p-3">Total ₹</th>
              <th className="p-3">Current</th>
              <th className="p-3">Order</th>
              <th className="p-3">Photo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const idx = i + 1;
              return (
                <tr key={idx} className="border-b hover:bg-gray-50 transition">
                  <td className="text-center p-3">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="include-check h-5 w-5 text-indigo-600 rounded"
                      onChange={(e) => toggleRow(e.target)}
                    />
                  </td>
                  <td className="font-semibold p-3">
                    {item.name}
                    <input type="hidden" name={`name_${idx}`} value={item.name} />
                  </td>
                  <td className="text-gray-600 p-3 text-center">₹{item.sum}</td>
                  <td className="p-3">
                    <input
                      name={`current_${idx}`}
                      type="number"
                      className="w-20 p-2 border border-gray-300 rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      name={`order_${idx}`}
                      type="number"
                      className="w-20 p-2 border border-gray-300 rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="p-3">
                    <label className="inline-block text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full cursor-pointer hover:bg-indigo-100 transition">
                      📷 Upload
                      <input
                        type="file"
                        name={`photo_${idx}`}
                        accept="image/*"
                        hidden
                        onChange={(e) => showFile(e.target)}
                      />
                    </label>
                    <div className="file-name text-xs text-indigo-600 mt-1 min-h-[1.2em]"></div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;