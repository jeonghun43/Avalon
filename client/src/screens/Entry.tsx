import { useState } from 'react';
import { api } from '../net/socket';
import { useStore } from '../store';

export function Entry() {
  const connected = useStore((s) => s.connected);
  const [hostName, setHostName] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await api.create(hostName);
    setBusy(false);
  };
  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await api.join(code, name);
    setBusy(false);
  };

  return (
    <div className="entry">
      <div className="entry-head">
        <div className="logo">AVALON</div>
        <p>원탁에 앉을 닉네임을 정해 주세요</p>
      </div>
      <div className="entry-row">
        <form className="ui entry-card" onSubmit={create}>
          <h2>방 만들기</h2>
          <label htmlFor="host-name" className="k">닉네임</label>
          <input id="host-name" className="field" maxLength={10} value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="1~10자" autoComplete="off" />
          <button className="btn" disabled={busy || !connected || !hostName.trim()}>방 만들기</button>
        </form>
        <form className="ui entry-card" onSubmit={join}>
          <h2>방 참가</h2>
          <label htmlFor="room-code" className="k">방 코드</label>
          <input id="room-code" className="field code" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="K7QM" autoComplete="off" />
          <label htmlFor="join-name" className="k">닉네임</label>
          <input id="join-name" className="field" maxLength={10} value={name} onChange={(e) => setName(e.target.value)} placeholder="1~10자" autoComplete="off" />
          <button className="btn" disabled={busy || !connected || code.length !== 4 || !name.trim()}>입장</button>
        </form>
      </div>
      <p className="k entry-foot">{connected ? '디스코드 같은 음성 채팅을 켜고 함께 플레이하세요.' : '서버에 연결하는 중이에요…'}</p>
    </div>
  );
}
