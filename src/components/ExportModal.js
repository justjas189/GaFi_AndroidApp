// ExportModal.js
// Two-step export flow: (1) pick a date range, (2) pick a file format.
// A live "receipt" chip in the middle shows exactly what will leave the app —
// count, range, and total — so the export is never a blind action.
//
// Uses TouchableOpacity (not Pressable) to match SettingsScreen and to avoid the
// project's known Pressable style-callback babel quirk. Heavy bits (date/month
// pickers, file-system, sharing) live here so the rest of the screen stays light.

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { FONTS } from '../theme/typography';
import { toast } from '../utils/toast';
import {
  getRangeBounds,
  filterExpensesByRange,
  summarizeRange,
  describeRange,
  expensesToCSV,
  expensesToTXT,
  writeAndShareExport,
} from '../utils/exportUtils';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const RANGE_OPTIONS = [
  { mode: 'all', label: 'All time', icon: 'infinite-outline', hint: 'Every expense you have logged' },
  { mode: 'month', label: 'Select month', icon: 'calendar-outline', hint: 'A single calendar month' },
  { mode: 'custom', label: 'Custom range', icon: 'options-outline', hint: 'Pick your own start and end' },
];

const fmtMoney = (n) =>
  `₱${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDay = (d) =>
  d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

const ExportModal = ({ visible, onClose, expenses = [], theme }) => {
  const now = useMemo(() => new Date(), []);

  const [step, setStep] = useState(1);
  const [mode, setMode] = useState('all');
  const [monthSel, setMonthSel] = useState(now.getMonth());
  const [yearSel, setYearSel] = useState(now.getFullYear());
  const [customStart, setCustomStart] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [customEnd, setCustomEnd] = useState(now);
  const [pickerTarget, setPickerTarget] = useState(null); // 'start' | 'end' | null
  const [busy, setBusy] = useState(false);

  // Fresh start every time the sheet opens.
  useEffect(() => {
    if (visible) {
      setStep(1);
      setMode('all');
      setBusy(false);
      setPickerTarget(null);
    }
  }, [visible]);

  // Years offered in the month picker: earliest logged expense → this year.
  const years = useMemo(() => {
    let earliest = now.getFullYear();
    for (const e of expenses) {
      const d = new Date(e.date || e.created_at);
      if (!Number.isNaN(d.getTime()) && d.getFullYear() < earliest) earliest = d.getFullYear();
    }
    const list = [];
    for (let y = now.getFullYear(); y >= earliest; y--) list.push(y);
    return list;
  }, [expenses, now]);

  // Derived during render (memoized) — never stored in state, so it can't drift.
  const rangeOpts = useMemo(
    () => ({ year: yearSel, month: monthSel, start: customStart, end: customEnd }),
    [yearSel, monthSel, customStart, customEnd]
  );
  const filtered = useMemo(
    () => filterExpensesByRange(expenses, getRangeBounds(mode, rangeOpts)),
    [expenses, mode, rangeOpts]
  );
  const summary = useMemo(() => summarizeRange(filtered), [filtered]);
  const rangeLabel = useMemo(() => describeRange(mode, rangeOpts), [mode, rangeOpts]);

  const hasRows = summary.count > 0;

  const handleClose = useCallback(() => {
    if (busy) return; // don't yank the sheet mid-write
    onClose?.();
  }, [busy, onClose]);

  const onChangeDate = useCallback(
    (event, selected) => {
      const target = pickerTarget;
      setPickerTarget(null); // Android dialog dismisses on any action
      if (event.type !== 'set' || !selected) return;
      if (target === 'start') {
        setCustomStart(selected);
        setCustomEnd((prev) => (selected > prev ? selected : prev));
      } else {
        setCustomEnd(selected);
        setCustomStart((prev) => (selected < prev ? selected : prev));
      }
    },
    [pickerTarget]
  );

  const handleExport = useCallback(
    async (format) => {
      if (!hasRows) {
        toast.info('Nothing in range', 'No expenses fall in the dates you picked.');
        return;
      }
      try {
        setBusy(true);
        const content =
          format === 'csv'
            ? expensesToCSV(filtered)
            : expensesToTXT(filtered, { rangeLabel });
        await writeAndShareExport({ content, format, rangeLabel });
        toast.success('Export ready', `${summary.count} expenses · ${format.toUpperCase()}`);
        onClose?.();
      } catch (error) {
        console.error('Export error:', error);
        toast.error('Export failed', error?.message || 'Could not create the file. Try again.');
      } finally {
        setBusy(false);
      }
    },
    [hasRows, filtered, rangeLabel, summary.count, onClose]
  );

  const c = theme.colors;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: c.background }]}>
          {step === 1 ? (
            <>
              <Ionicons
                name="download-outline"
                size={40}
                color={c.primary}
                style={styles.headerIcon}
              />
              <Text style={[styles.title, { color: c.text }]}>Export expenses</Text>
              <Text style={[styles.subtitle, { color: c.textSecondary }]}>
                Pick a date range, then choose a file format.
              </Text>

              {/* Range options */}
              <View style={styles.optionList}>
                {RANGE_OPTIONS.map((opt) => {
                  const active = mode === opt.mode;
                  return (
                    <TouchableOpacity
                      key={opt.mode}
                      style={[
                        styles.optionRow,
                        {
                          backgroundColor: c.card,
                          borderColor: active ? c.primary : c.border,
                        },
                      ]}
                      onPress={() => setMode(opt.mode)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={20}
                        color={active ? c.primary : c.textSecondary}
                        style={styles.optionIcon}
                      />
                      <View style={styles.optionInfo}>
                        <Text style={[styles.optionLabel, { color: c.text }]}>{opt.label}</Text>
                        <Text style={[styles.optionHint, { color: c.textSecondary }]}>{opt.hint}</Text>
                      </View>
                      <Ionicons
                        name={active ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={active ? c.primary : c.border}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Month picker reveal */}
              {mode === 'month' && (
                <View style={styles.pickerRow}>
                  <View style={[styles.pickerBox, { backgroundColor: c.card, borderColor: c.border }]}>
                    <Picker
                      selectedValue={monthSel}
                      onValueChange={setMonthSel}
                      dropdownIconColor={c.text}
                      style={{ color: c.text }}
                    >
                      {MONTHS.map((m, i) => (
                        <Picker.Item key={m} label={m} value={i} color={c.text} />
                      ))}
                    </Picker>
                  </View>
                  <View style={[styles.pickerBox, styles.pickerBoxYear, { backgroundColor: c.card, borderColor: c.border }]}>
                    <Picker
                      selectedValue={yearSel}
                      onValueChange={setYearSel}
                      dropdownIconColor={c.text}
                      style={{ color: c.text }}
                    >
                      {years.map((y) => (
                        <Picker.Item key={y} label={String(y)} value={y} color={c.text} />
                      ))}
                    </Picker>
                  </View>
                </View>
              )}

              {/* Custom range reveal */}
              {mode === 'custom' && (
                <View style={styles.dateRow}>
                  <TouchableOpacity
                    style={[styles.dateField, { backgroundColor: c.card, borderColor: c.border }]}
                    onPress={() => setPickerTarget('start')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dateFieldLabel, { color: c.textSecondary }]}>From</Text>
                    <Text style={[styles.dateFieldValue, { color: c.text }]}>{fmtDay(customStart)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateField, { backgroundColor: c.card, borderColor: c.border }]}
                    onPress={() => setPickerTarget('end')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dateFieldLabel, { color: c.textSecondary }]}>To</Text>
                    <Text style={[styles.dateFieldValue, { color: c.text }]}>{fmtDay(customEnd)}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Signature: live summary of what will be exported */}
              <View style={[styles.summary, { backgroundColor: `${c.primary}12`, borderColor: `${c.primary}30` }]}>
                <Ionicons
                  name={hasRows ? 'receipt-outline' : 'alert-circle-outline'}
                  size={18}
                  color={hasRows ? c.primary : c.textSecondary}
                />
                <View style={styles.summaryInfo}>
                  {hasRows ? (
                    <>
                      <Text style={[styles.summaryLine, { color: c.text }]}>
                        {summary.count} {summary.count === 1 ? 'expense' : 'expenses'} · {fmtMoney(summary.total)}
                      </Text>
                      <Text style={[styles.summarySub, { color: c.textSecondary }]}>{rangeLabel}</Text>
                    </>
                  ) : (
                    <Text style={[styles.summarySub, { color: c.textSecondary }]}>
                      No expenses in this range
                    </Text>
                  )}
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnGhost, { backgroundColor: c.card }]}
                  onPress={handleClose}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.btnGhostText, { color: c.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { backgroundColor: c.primary, opacity: hasRows ? 1 : 0.45 }]}
                  onPress={() => setStep(2)}
                  disabled={!hasRows}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnPrimaryText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.back}
                onPress={() => !busy && setStep(1)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={22} color={c.text} />
                <Text style={[styles.backText, { color: c.text }]}>Range</Text>
              </TouchableOpacity>

              <Text style={[styles.title, { color: c.text }]}>Choose a format</Text>
              <Text style={[styles.subtitle, { color: c.textSecondary }]}>
                {summary.count} {summary.count === 1 ? 'expense' : 'expenses'} · {rangeLabel}
              </Text>

              <View style={styles.formatRow}>
                <TouchableOpacity
                  style={[styles.formatCard, { backgroundColor: c.card, borderColor: c.border }]}
                  onPress={() => handleExport('csv')}
                  disabled={busy}
                  activeOpacity={0.85}
                >
                  <Ionicons name="grid-outline" size={28} color={c.primary} />
                  <Text style={[styles.formatTitle, { color: c.text }]}>CSV</Text>
                  <Text style={[styles.formatHint, { color: c.textSecondary }]}>Opens in Excel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formatCard, { backgroundColor: c.card, borderColor: c.border }]}
                  onPress={() => handleExport('txt')}
                  disabled={busy}
                  activeOpacity={0.85}
                >
                  <Ionicons name="document-text-outline" size={28} color={c.primary} />
                  <Text style={[styles.formatTitle, { color: c.text }]}>TXT</Text>
                  <Text style={[styles.formatHint, { color: c.textSecondary }]}>Plain, readable text</Text>
                </TouchableOpacity>
              </View>

              {busy && (
                <View style={styles.busyRow}>
                  <ActivityIndicator size="small" color={c.primary} />
                  <Text style={[styles.busyText, { color: c.textSecondary }]}>Preparing file…</Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>

      {/* Native date dialog (Android) — rendered only while a field is being edited */}
      {pickerTarget && (
        <DateTimePicker
          value={pickerTarget === 'start' ? customStart : customEnd}
          mode="date"
          display="default"
          maximumDate={now}
          onChange={onChangeDate}
        />
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  headerIcon: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: FONTS.headingBold,
    fontSize: 22,
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },

  // Range options
  optionList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  optionIcon: {
    marginRight: 12,
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    marginBottom: 1,
  },
  optionHint: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    opacity: 0.8,
  },

  // Month/year pickers
  pickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  pickerBox: {
    flex: 2,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
  },
  pickerBoxYear: {
    flex: 1,
  },

  // Custom date fields
  dateRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  dateField: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dateFieldLabel: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    marginBottom: 3,
  },
  dateFieldValue: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
  },

  // Live summary chip
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 18,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryLine: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
  },
  summarySub: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnGhost: {},
  btnGhostText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
  },
  btnPrimary: {},
  btnPrimaryText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: '#fff',
  },

  // Step 2
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    marginLeft: 2,
  },
  formatRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  formatCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 22,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  formatTitle: {
    fontFamily: FONTS.headingBold,
    fontSize: 18,
    letterSpacing: 0.5,
  },
  formatHint: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    textAlign: 'center',
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
  },
  busyText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
  },
});

export default ExportModal;
