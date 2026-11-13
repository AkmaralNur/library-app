import { useState } from 'react';
import { api } from '../../api';
import { Field, Input } from '../ui/Inputs';

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
  reader.readAsDataURL(file);
});

// Обложка: выбранный файл сразу загружается на сервер, а его ссылка подставляется в поле
export default function CoverField({ initialUrl }) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState('');
  const preview = url.trim();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await readAsDataUrl(file);
      const uploaded = await api.post('/api/covers', { data });
      setUrl(uploaded.url);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex items-start gap-3">
      {preview && <img className="h-32 w-[90px] shrink-0 rounded bg-[#eee] object-cover" src={preview} alt="" />}
      <div className="flex-1">
        <Field label="Обложка">
          <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} />
        </Field>
        <Field label="или ссылка на картинку">
          <Input name="cover_url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
        {error && <p className="mb-3 text-danger">{error}</p>}
      </div>
    </div>
  );
}
