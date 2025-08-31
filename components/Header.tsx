import React from 'react';

const Header: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="mb-8">
    <h1 className="text-[36px] font-bold text-slate-900 tracking-tight">{title}</h1>
    <p className="mt-2 text-lg text-slate-600">{subtitle}</p>
  </div>
);

export default Header;
