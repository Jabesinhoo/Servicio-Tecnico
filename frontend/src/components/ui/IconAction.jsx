import React from 'react';

// Keep icon actions named for screen readers and large enough for touch input.
export default function IconAction({label,icon:Icon,className='',...props}) {
  return <button type="button" {...props} aria-label={label} title={label} className={`icon-action accent-text hover:accent-soft ${className}`}><Icon className="w-5 h-5" aria-hidden="true"/></button>;
}
