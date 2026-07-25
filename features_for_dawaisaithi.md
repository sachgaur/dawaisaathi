# Product Requirements Document

**Project:** Medication and Family Dose Management App

## Overview

This app helps families manage medicines, prescriptions, dosage schedules, and reminders in a shared group-based system. The goal is to improve coordination, reduce missed doses, and make prescription tracking clearer and more reliable for all group members.

## Objective

Build a family or group medication management system where one admin can manage members, prescriptions, schedules, notifications, and dosage history in a simple and clear way.

## Core Feature Requirements

1. **Group Admin Invitations**  
   The group admin should be able to invite members using email or QR code.

2. **Multiple Group Support**  
   Users should be able to create and manage multiple groups. The term "family group" can be replaced with a more flexible name such as "care group" or "medicine group."

3. **Shared Dose Schedule**  
   When a dose is added to a group, the schedule should automatically be visible to every member of that group as a list with the name of the member who added, not as a tab.

4. **Custom Dosage Timings**  
   Dosage timings should be customizable based on the uploaded prescription and treatment plan.

5. **Dosage History Tracking**  
   The system should store the full history of each dosage, including whether it was taken, missed, or skipped.

6. **Advanced Notifications**  
   Notifications should support custom human voice reminders or long vibration alerts to improve attention and accessibility.

7. **Motivational Reminder Style**  
   Notification behavior can be designed in a more engaging style, similar to habit-reminder apps like Duolingo.

8. **Dose Logging Window**  
   Users should only be able to log a dose starting 30 minutes before the scheduled dosage time.

9. **Dosage Calendar**  
   The app should include a calendar view to help users track upcoming and past dosages.

10. **One Prescription Per Group**  
    Each group should maintain one shared prescription instead of having each member upload separate prescriptions.

11. **Clear Timing Display in Cabinets**  
    Dosage timings shown in the cabinets section should be displayed more clearly, as the current presentation is confusing.

## User Roles

1. **Group Admin**  
   Can create groups, invite members, upload prescriptions, manage medicine schedules, and monitor adherence history.

2. **Group Member**  
   Can view prescriptions, check dose schedules, receive reminders, and log doses within the allowed time window.
   Can update or add the new prescription only if the group admin gives the priviliges.

## Functional Requirements

1. The system must allow group creation and member management.
2. The system must support one shared prescription per group.
3. The system must display the same dosage schedule to all group members.
4. The system must allow custom dose timing configuration.
5. The system must maintain a complete dosage log history.
6. The system must provide reminder notifications with configurable alert styles.
7. The system must restrict dose logging to 30 minutes before the scheduled time.
8. The system must provide a calendar-based schedule view.
9. The system must clearly differentiate medicine timings in the cabinets section.



## Expected Outcome

The app should evolve from a basic medicine tracker into a clearer group-based medication management platform with better scheduling, shared prescription handling, stronger reminders, and improved reliability.
