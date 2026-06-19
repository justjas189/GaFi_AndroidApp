// src/components/feedback/ConfirmProvider.js
// Mounts a single ConfirmModal at the root and exposes a promise-based confirm()
// via useConfirm(). Turns a 6-line Alert.alert(title, msg, [cancel, {onPress}])
// into: if (await confirm({ title, message, confirmLabel, destructive: true })) {...}.

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import ConfirmModal from './ConfirmModal';

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState({ visible: false, options: {} });
  const resolver = useRef(null);

  const confirm = useCallback((options = {}) => {
    setState({ visible: true, options });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((result) => {
    setState((s) => ({ ...s, visible: false }));
    resolver.current?.(result);
    resolver.current = null;
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmModal
        visible={state.visible}
        {...state.options}
        onConfirm={() => close(true)}
        onCancel={() => close(false)}
      />
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return ctx;
};

export default ConfirmProvider;
