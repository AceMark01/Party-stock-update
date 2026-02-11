// src/App.jsx - Final Working Version (Black Image from Camera Fixed)

import { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import supabase from './supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Image as ImageIcon, X, Upload, Aperture } from 'lucide-react';

function App() {
  const [party, setParty] = useState('Unknown Party');
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLogs, setActionLogs] = useState({});
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [currentPhotoRow, setCurrentPhotoRow] = useState(null);
  const videoRef = useRef(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [capturing, setCapturing] = useState(false);

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

    const loadActionLogs = async () => {
      const { data, error } = await supabase
        .from('action_logs')
        .select('items_name, action_status')
        .eq('party_name', p);

      if (error) {
        console.error('Action logs load error:', error);
        return;
      }

      const logsMap = {};
      data.forEach(log => {
        if (log.items_name) {
          logsMap[log.items_name.trim()] = log.action_status;
        }
      });

      setActionLogs(logsMap);
    };

    loadActionLogs();
    loadItems();

    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [party]);

  useEffect(() => {
    items.forEach((item, i) => {
      const idx = i + 1;
      const row = document.querySelector(`tr[data-row="${idx}"]`);
      if (row) {
        const select = row.querySelector('select[name^="action_"]');
        if (select) handleActionChange(select);
      }
    });
  }, [items, actionLogs]);

  const toggleAll = (checked) => {
    document.querySelectorAll('.include-check').forEach(c => {
      c.checked = checked;
      toggleRow(c);
    });
  };

  const toggleRow = (checkbox) => {
    const row = checkbox.closest('tr');
    row.classList.toggle('opacity-35', !checkbox.checked);
    row.querySelectorAll('input:not(.include-check), select').forEach(i => {
      i.disabled = !checkbox.checked;
    });
  };

  const handleActionChange = (select) => {
    const row = select.closest('tr');
    const value = select.value;

    if (value === 'Not Required' || value === 'Duplicate') {
      row.classList.add('opacity-35');
      row.querySelectorAll('input[type="number"], select[name^="uom_"], input[type="file"]').forEach(i => i.disabled = true);
    } else {
      row.classList.remove('opacity-35');
      row.querySelectorAll('input[type="number"], select[name^="uom_"], input[type="file"]').forEach(i => i.disabled = false);
    }
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

    const mainSubmissions = [];
    const actionUpdates = [];
    const uploadPromises = [];
    let validationFailed = false;

    const batchUniqueKey = crypto.randomUUID();

    document.querySelectorAll('tr').forEach((row) => {
      const check = row.querySelector('.include-check');
      if (!check || !check.checked) return;

      const nameInput = row.querySelector('input[name^="name_"]');
      const currentInput = row.querySelector('input[name^="current_"]');
      const orderInput = row.querySelector('input[name^="order_"]');
      const uomSelect = row.querySelector('select[name^="uom_"]');
      const photoInput = row.querySelector('input[type="file"]');
      const actionSelect = row.querySelector('select[name^="action_"]');

      const productName = nameInput?.value?.trim() || '';
      const current = currentInput?.value?.trim() || '';
      const order = orderInput?.value?.trim() || '';
      const uom = uomSelect?.value?.trim() || '';
      const actionStatus = actionSelect?.value?.trim() || '';
      const hasPhoto = photoInput?.files?.length > 0;

      const isSpecialAction = actionStatus === 'Not Required' || actionStatus === 'Duplicate';

      if (!isSpecialAction && (!current || !order || !uom || !hasPhoto)) {
        validationFailed = true;
        return;
      }

      let photoPromise = Promise.resolve('(No Photo)');

      if (hasPhoto) {
        const file = photoInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${party.replace(/\s+/g, '_')}/${crypto.randomUUID()}.${fileExt}`;

        photoPromise = supabase.storage
          .from('stock-photos')
          .upload(fileName, file, { cacheControl: '3600', upsert: false })
          .then(({ data, error: uploadError }) => {
            if (uploadError) {
              console.error('Photo upload error:', uploadError);
              toast.error(`Photo upload fail: ${file.name}`);
              return '(Upload failed)';
            }
            const { data: urlData } = supabase.storage.from('stock-photos').getPublicUrl(fileName);
            return urlData.publicUrl;
          })
          .catch(err => {
            console.error('Unexpected upload error:', err);
            return '(Upload failed)';
          });
      }

      uploadPromises.push(
        photoPromise.then(photoUrl => {
          const submission = {
            party,
            product_name: productName,
            current_qty: Number(current) || 0,
            order_qty: Number(order) || 0,
            uom,
            photo_url: photoUrl,
            action_status: actionStatus,
            unique_key: batchUniqueKey
          };

          if (isSpecialAction) {
            actionUpdates.push({
              party_name: party,
              items_name: productName,
              action_status: actionStatus,
              unique_id: batchUniqueKey
            });
          } else {
            mainSubmissions.push(submission);
          }
        })
      );
    });

    if (validationFailed) {
      setLoading(false);
      toast.error('Normal rows mein Current Qty, Order Qty, UOM aur Photo fill karo!');
      return;
    }

    await Promise.all(uploadPromises);

    if (mainSubmissions.length === 0 && actionUpdates.length === 0) {
      setLoading(false);
      toast.error('Koi row select nahi kiya');
      return;
    }

    if (mainSubmissions.length > 0) {
      const { error } = await supabase.from('stock_submissions').insert(mainSubmissions);
      if (error) {
        console.error('Stock submissions error:', error);
        toast.error('Stock data save nahi hua');
      }
    }

    if (actionUpdates.length > 0) {
      const { error } = await supabase
        .from('action_logs')
        .upsert(actionUpdates, { onConflict: 'party_name, items_name', ignoreDuplicates: false });

      if (error) {
        console.error('Action logs error:', error);
        toast.error('Action logs save/update nahi hua');
      }
    }

    setLoading(false);
    toast.success('Successfully Saved!');
    setTimeout(() => window.location.reload(), 2500);
  };

  const openPhotoPicker = (rowIndex) => {
    setCurrentPhotoRow(rowIndex);
    setShowPhotoPicker(true);
  };

  const handleGallerySelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const row = document.querySelector(`tr[data-row="${currentPhotoRow}"]`);
      if (row) {
        const fileInput = row.querySelector('input[type="file"]');
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        row.querySelector('.file-name').textContent = `✔ ${file.name}`;
      }
      toast.success('Photo attached!');
    }
    setShowPhotoPicker(false);
    setCurrentPhotoRow(null);
  };

  const openCamera = () => {
    setShowPhotoPicker(false);
    setShowCamera(true);
  };

  useEffect(() => {
    if (showCamera) {
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 }
            }
          });
          setCameraStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(e => console.error('Video play error:', e));
          }
        } catch (err) {
          console.error('Camera access error:', err);
          toast.error('Camera access denied or unavailable. Permissions check karo.');
          setShowCamera(false);
        }
      };
      startCamera();
    }

    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
    };
  }, [showCamera]);

  const capturePhoto = async () => {
    if (!videoRef.current || capturing) return;
    setCapturing(true);

    try {
      const video = videoRef.current;

      // Wait until video is really ready (important for mobile)
      if (video.readyState < video.HAVE_ENOUGH_DATA) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Canvas context failed');

      // Fill white background (prevents black areas in some browsers)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw image twice → very effective fix for black frame on mobile
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Small delay + opacity trick to reduce perceived flash/black
      video.style.opacity = '0';
      await new Promise(r => setTimeout(r, 80));
      video.style.opacity = '1';

      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.92);
      });

      if (!blob || blob.size < 2000) {
        throw new Error('Captured image is empty or corrupted');
      }

      const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });

      const row = document.querySelector(`tr[data-row="${currentPhotoRow}"]`);
      if (row) {
        const fileInput = row.querySelector('input[type="file"]');
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        row.querySelector('.file-name').textContent = `✔ ${file.name}`;
      }

      toast.success('Photo captured successfully!');

      setTimeout(() => {
        setShowCamera(false);
        setCurrentPhotoRow(null);
        setCapturing(false);
      }, 600);

    } catch (err) {
      console.error('Capture failed:', err);
      toast.error('Camera se photo capture nahi hui – gallery use karo ya page refresh karke try karo');
      setCapturing(false);
      if (videoRef.current) videoRef.current.style.opacity = '1';
    }
  };

  return (
    <div className="font-sans bg-gradient-to-b from-slate-50 to-indigo-50 min-h-screen">
      <Toaster position="bottom-center" />

      {loading && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white px-8 py-6 rounded-xl text-center">
            <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <div className="font-semibold">Saving...</div>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-50 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div>
            <div className="text-xs opacity-80">Stock Update</div>
            <div className="text-lg font-bold">{party}</div>
            <div className="text-xs mt-1 opacity-90">
              Total Items: <span className="font-semibold">{totalItems}</span>
            </div>
          </div>
          {!isMobile && (
            <div className="flex gap-2">
              <button onClick={() => toggleAll(true)} className="px-3 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition">Enable</button>
              <button onClick={() => toggleAll(false)} className="px-3 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition">Disable</button>
              <button onClick={submitForm} className="px-4 py-2 bg-black/30 rounded-lg font-semibold hover:bg-black/40 transition">Submit</button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 bg-white rounded-2xl shadow-xl mt-4 overflow-x-auto pb-24 md:pb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-indigo-700">
              <th className="p-3">Select</th>
              <th className="p-3 text-left">Product</th>
              <th className="p-3">Total ₹</th>
              <th className="p-3">Action</th>
              <th className="p-3">Current</th>
              <th className="p-3">Order</th>
              <th className="p-3">UOM</th>
              <th className="p-3">Photo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const idx = i + 1;
              const prefilledAction = actionLogs[item.name] || '';
              let statusColor = '';
              let statusText = '';

              if (prefilledAction === 'Duplicate') {
                statusColor = 'text-red-600 font-medium';
                statusText = 'Duplicate (Already Marked)';
              } else if (prefilledAction === 'Not Required') {
                statusColor = 'text-blue-600 font-medium';
                statusText = 'Not Required (Already Marked)';
              }

              return (
                <tr key={idx} data-row={idx} className="border-b hover:bg-gray-50 transition">
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
                    <select
                      name={`action_${idx}`}
                      defaultValue={prefilledAction}
                      className={`w-full p-2 border border-gray-300 rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 ${prefilledAction ? 'font-medium' : ''}`}
                      onChange={(e) => handleActionChange(e.target)}
                    >
                      <option value="">Select Action</option>
                      <option value="Not Required">Not Required</option>
                      <option value="Duplicate">Duplicate</option>
                    </select>
                    {prefilledAction && (
                      <div className={`text-xs mt-1 ${statusColor}`}>{statusText}</div>
                    )}
                  </td>

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
                    <select
                      name={`uom_${idx}`}
                      className="w-24 p-2 border border-gray-300 rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Nos">Nos</option>
                      <option value="Pcs">Pcs</option>
                      <option value="Bundle">Bundle</option>
                    </select>
                  </td>

                  <td className="p-3">
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => showFile(e.target)}
                    />
                    <button
                      onClick={() => openPhotoPicker(idx)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full hover:bg-indigo-100 transition shadow-sm"
                    >
                      <Upload className="h-4 w-4" />
                      Attach
                    </button>
                    <div className="file-name text-xs text-indigo-600 mt-1 min-h-[1.2em]"></div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Bottom Bar - Raised */}
      {isMobile && (
        <div
          className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-4 shadow-2xl z-50"
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-7xl mx-auto flex gap-3">
            <button
              onClick={() => toggleAll(true)}
              className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-md text-base font-medium"
            >
              Enable All
            </button>
            <button
              onClick={() => toggleAll(false)}
              className="flex-1 py-3.5 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition shadow-md text-base font-medium"
            >
              Disable All
            </button>
            <button
              onClick={submitForm}
              className="flex-1 py-3.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition shadow-md disabled:bg-gray-400 text-base font-medium"
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      )}

      {/* Photo Picker */}
      <AnimatePresence>
        {showPhotoPicker && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 max-h-[70vh] overflow-y-auto z-50 shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Attach Photo</h3>
              <button onClick={() => setShowPhotoPicker(false)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="h-6 w-6 text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <button onClick={openCamera} className="flex flex-col items-center gap-2 p-5 bg-blue-50 rounded-2xl border-2 border-dashed border-blue-300 hover:border-blue-500 transition cursor-pointer">
                <Camera className="h-8 w-8 text-blue-600" />
                <span className="text-blue-700 font-medium text-sm">Camera</span>
              </button>

              <label className="flex flex-col items-center gap-2 p-5 bg-green-50 rounded-2xl border-2 border-dashed border-green-300 hover:border-green-500 transition cursor-pointer">
                <ImageIcon className="h-8 w-8 text-green-600" />
                <span className="text-green-700 font-medium text-sm">Gallery</span>
                <input type="file" accept="image/*" onChange={handleGallerySelect} hidden />
              </label>

              <button onClick={() => setShowPhotoPicker(false)} className="flex flex-col items-center gap-2 p-5 bg-gray-100 rounded-2xl hover:bg-gray-200 transition">
                <X className="h-8 w-8 text-gray-600" />
                <span className="text-gray-700 font-medium text-sm">Cancel</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera View */}
      <AnimatePresence>
        {showCamera && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto z-50 shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Live Camera</h3>
              <button
                onClick={() => {
                  setShowCamera(false);
                  if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
                }}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="h-6 w-6 text-gray-500" />
              </button>
            </div>

            <div className="relative w-full h-[55vh] sm:h-[60vh] bg-black rounded-2xl overflow-hidden mb-6 shadow-inner">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                autoPlay
                muted
              />
              <div className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-200 ${capturing ? 'opacity-40' : 'opacity-0'}`} />
            </div>

            <button
              onClick={capturePhoto}
              disabled={capturing}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Aperture className="h-5 w-5" />
              {capturing ? 'Capturing...' : 'Capture Photo'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;