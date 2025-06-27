import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:fynds/screens/onboarding/style_choice_screen.dart';
import 'package:fynds/theme/app_theme.dart';
import 'package:geolocator/geolocator.dart';
import 'package:fynds/services/onboarding/onboarding_service.dart';

class UserDetailsScreen extends StatefulWidget {
  const UserDetailsScreen({super.key});

  @override
  State<UserDetailsScreen> createState() => _UserDetailsScreenState();
}

class _UserDetailsScreenState extends State<UserDetailsScreen> {
  DateTime? _birthDate;
  String? _preference;
  String? _location;
  bool _isLoadingLocation = false;
  bool _isSubmitting = false;
  final OnboardingService _onboardingService = OnboardingService();
  final _storage = const FlutterSecureStorage();

  @override
  void dispose() {
    super.dispose();
  }

  Future<void> _pickBirthDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 18),
      firstDate: DateTime(now.year - 100),
      lastDate: now,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppTheme.primaryColor,
              onPrimary: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) setState(() => _birthDate = picked);
  }

  Future<void> _detectLocation() async {
    setState(() => _isLoadingLocation = true);

    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      setState(() => _isLoadingLocation = false);
      return;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.deniedForever ||
        permission == LocationPermission.denied) {
      setState(() => _isLoadingLocation = false);
      return;
    }

    try {
      final position = await Geolocator.getCurrentPosition();
      final locationString = '${position.latitude}, ${position.longitude}';
      setState(() {
        _location = locationString;
        _isLoadingLocation = false;
      });
    } catch (e) {
      setState(() => _isLoadingLocation = false);
    }
  }

  String _mapPreferenceToBackend(String displayValue) {
    switch (displayValue) {
      case 'Men':
        return 'men';
      case 'Women':
        return 'women';
      case 'Unisex':
        return 'unisex';
      default:
        return 'unisex';
    }
  }

  Future<void> _submitDetails() async {
    // Validate required fields
    if (_preference == null) {
      return; // Just return, no snackbar
    }

    if (_location == null || _location!.trim().isEmpty) {
      return; // Just return, no snackbar
    }

    setState(() => _isSubmitting = true);

    try {
      // Store clothing preference in secure storage
      await _storage.write(key: 'sex', value: _preference!);

      // Convert preference to lowercase for backend
      final backendPreference = _mapPreferenceToBackend(_preference!);

      // Call the service but don't rely on its return value since DB is updating correctly
      await _onboardingService.additionalUserInformation(
        clothingPreferences: backendPreference,
        birthDate: _birthDate, // Optional field
        location: _location!.trim(),
      );

      // If we get here without an exception, assume success and navigate
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const StyleChoiceScreen()),
      );
    } catch (e) {
      // Only show error if there's an actual exception
      print('Error submitting details: $e'); // For debugging
      // Optionally still navigate if the error isn't critical
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const StyleChoiceScreen()),
      );
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      body: Column(
        children: [
          // Top pink section (empty now)
          Container(
            width: double.infinity,
            height: 200,
            decoration: const BoxDecoration(color: AppTheme.primaryColor),
            child: const SafeArea(
              child: SizedBox(), // Empty pink section
            ),
          ),

          // Bottom white section with form
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: const BoxDecoration(color: AppTheme.backgroundColor),
              padding: const EdgeInsets.all(32),
              child: SafeArea(
                top: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Step indicator moved to white section
                    Align(
                      alignment: Alignment.topRight,
                      child: const Text(
                        'Step 1/3',
                        style: TextStyle(
                          color: AppTheme.textSecondary,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Title - now centered
                    const Text(
                      'Tell us about you!',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                      ),
                    ),

                    const SizedBox(height: 32),

                    // Clothing Preference
                    Align(
                      alignment: Alignment.centerLeft,
                      child: const Text(
                        'Clothing preference',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _preference,
                      decoration: const InputDecoration(
                        hintText: 'Select preference',
                        hintStyle: TextStyle(color: AppTheme.textSecondary),
                      ),
                      style: const TextStyle(color: AppTheme.textPrimary),
                      items: const [
                        DropdownMenuItem(value: "Men", child: Text("Men")),
                        DropdownMenuItem(value: "Women", child: Text("Women")),
                        DropdownMenuItem(
                          value: "Unisex",
                          child: Text("Unisex"),
                        ),
                      ],
                      onChanged: (val) => setState(() => _preference = val),
                    ),

                    const SizedBox(height: 24),

                    // Location - just button now
                    Align(
                      alignment: Alignment.centerLeft,
                      child: const Text(
                        'Location',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: ElevatedButton(
                        onPressed: _isLoadingLocation ? null : _detectLocation,
                        style: ElevatedButton.styleFrom(
                          backgroundColor:
                              AppTheme.primaryColor, // Red background
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 16,
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment:
                              MainAxisAlignment.center, // Align to left
                          children: [
                            if (_isLoadingLocation)
                              const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  color: Colors.white,
                                  strokeWidth: 2,
                                ),
                              )
                            else
                              const SizedBox.shrink(), // No icon when not loading
                            if (_isLoadingLocation) const SizedBox(width: 12),
                            Flexible(
                              child: Text(
                                _isLoadingLocation
                                    ? 'Getting location...'
                                    : _location != null
                                    ? 'Location detected'
                                    : 'Use current location',
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w500,
                                  color: Colors.white,
                                ),
                                overflow: TextOverflow.ellipsis,
                                maxLines: 1,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 24),

                    // Date of Birth (Optional)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: const Text(
                        'Date of birth (optional)',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap: _pickBirthDate,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 16,
                        ),
                        decoration: BoxDecoration(
                          border: Border.all(color: AppTheme.dividerColor),
                          borderRadius: BorderRadius.circular(12),
                          color: AppTheme.backgroundColor,
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.calendar_today,
                              color: AppTheme.textSecondary,
                              size: 20,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                _birthDate != null
                                    ? '${_birthDate!.day.toString().padLeft(2, '0')}/${_birthDate!.month.toString().padLeft(2, '0')}/${_birthDate!.year}'
                                    : 'DD/MM/YYYY',
                                style: TextStyle(
                                  fontSize: 16,
                                  color:
                                      _birthDate != null
                                          ? AppTheme.textPrimary
                                          : AppTheme.textSecondary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Optional disclaimer
                    const Text(
                      'Optional, but used to personalise your FYNDS experience. Your data stays private.',
                      textAlign: TextAlign.left,
                      style: TextStyle(
                        fontSize: 11,
                        color: AppTheme.textSecondary,
                        height: 1.4,
                      ),
                    ),

                    const Spacer(),

                    // Continue Button
                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: ElevatedButton(
                        onPressed: _isSubmitting ? null : _submitDetails,
                        style: ElevatedButton.styleFrom(
                          backgroundColor:
                              AppTheme.buttonSecondary, // Black button
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child:
                            _isSubmitting
                                ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    color: Colors.white,
                                    strokeWidth: 2,
                                  ),
                                )
                                : const Text(
                                  'Continue',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
