'use client';
import { ActivityDialog, type ActivityProps } from './ActivityDialog';
export function LogRideModal(props: ActivityProps) { return <ActivityDialog {...props} kind="ride" />; }
