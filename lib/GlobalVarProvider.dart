import 'dart:io';

import 'package:flutter/material.dart';

class GlobalProvider extends ChangeNotifier {
  int A4SingBlaWh = 2;
  int A4SingColor = 5;
  int A4DoubBlaWh = 3;
  int A4DoubColor = 6;

  int A3SingBlaWh = 4;
  int A3SingColor = 8;
  int A3DoubBlaWh = 5;
  int A3DoubColor = 10;

  int SoftBinding = 20;
  int HardBinding = 30;
  int EmergencyPr = 15;
  int Commision = 0;

  late  File finalFile;

  void updateValues({
    int? a4SingBlaWh,
    int? a4SingColor,
    int? a4DoubBlaWh,
    int? a4DoubColor,
    int? a3SingBlaWh,
    int? a3SingColor,
    int? a3DoubBlaWh,
    int? a3DoubColor,
    int? softBinding,
    int? hardBinding,
    int? emergencyPr,
    int? commision,
    File? finalFile
  }) {
    if (a4SingBlaWh != null) A4SingBlaWh = a4SingBlaWh;
    if (a4SingColor != null) A4SingColor = a4SingColor;
    if (a4DoubBlaWh != null) A4DoubBlaWh = a4DoubBlaWh;
    if (a4DoubColor != null) A4DoubColor = a4DoubColor;
    if (a3SingBlaWh != null) A3SingBlaWh = a3SingBlaWh;
    if (a3SingColor != null) A3SingColor = a3SingColor;
    if (a3DoubBlaWh != null) A3DoubBlaWh = a3DoubBlaWh;
    if (a3DoubColor != null) A3DoubColor = a3DoubColor;
    if (softBinding != null) SoftBinding = softBinding;
    if (hardBinding != null) HardBinding = hardBinding;
    if (emergencyPr != null) EmergencyPr = emergencyPr;
    if (commision != null) Commision = commision;
    if (finalFile != null) finalFile = finalFile;

    notifyListeners(); // Notify UI to rebuild if needed
  }
}


// final globalProvider = context.watch<GlobalProvider>();
//
// int A4SingBlaWh = globalProvider.A4SingBlaWh;
// int A4SingColor = globalProvider.A4SingColor;
// int A4DoubBlaWh = globalProvider.A4DoubBlaWh;
// int A4DoubColor = globalProvider.A4DoubColor;
//
// int A3SingBlaWh = globalProvider.A3SingBlaWh;
// int A3SingColor = globalProvider.A3SingColor;
// int A3DoubBlaWh = globalProvider.A3DoubBlaWh;
// int A3DoubColor = globalProvider.A3DoubColor;
//
// int SoftBinding = globalProvider.SoftBinding;
// int HardBinding = globalProvider.HardBinding;
// int EmergencyPr = globalProvider.EmergencyPr;
