import 'package:fynds/models/style.dart';
import 'package:fynds/models/style_with_image.dart';
import 'package:flutter/widgets.dart';

class StyleWithImageComplete {
  final Style style;
  final StyleWithImage previewImage;

  StyleWithImageComplete({required this.style, required this.previewImage});

  // Quick accessors
  int get id => style.id;
  String get name => style.name;
  String get description => style.description ?? '';
  String get imageData => previewImage.imageData;
  Widget get imageWidget => previewImage.imageWidget;
}
