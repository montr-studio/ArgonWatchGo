package auth

import (
	"bytes"
	"encoding/base64"
	"fmt"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
	"github.com/skip2/go-qrcode"
)

// TOTPManager handles TOTP operations
type TOTPManager struct {
	issuer string
}

// NewTOTPManager creates a new TOTP manager
func NewTOTPManager(issuer string) *TOTPManager {
	return &TOTPManager{
		issuer: issuer,
	}
}

// GenerateSecret generates a new TOTP secret for a user
func (tm *TOTPManager) GenerateSecret(username string) (*otp.Key, error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      tm.issuer,
		AccountName: username,
	})
	if err != nil {
		return nil, err
	}

	return key, nil
}

// GenerateQRCode generates a QR code image for TOTP setup
func (tm *TOTPManager) GenerateQRCode(key *otp.Key) (string, error) {
	// Generate QR code as PNG
	png, err := qrcode.Encode(key.String(), qrcode.Medium, 256)
	if err != nil {
		return "", err
	}

	// Convert to base64 data URL
	var buf bytes.Buffer
	buf.WriteString("data:image/png;base64,")
	buf.WriteString(base64.StdEncoding.EncodeToString(png))

	return buf.String(), nil
}

// ValidateToken validates a TOTP token
func (tm *TOTPManager) ValidateToken(secret, token string) bool {
	return totp.Validate(token, secret)
}

// GenerateQRCodeFromSecret generates QR code from existing secret
func (tm *TOTPManager) GenerateQRCodeFromSecret(username, secret string) (string, error) {
	url := fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s",
		tm.issuer, username, secret, tm.issuer)

	png, err := qrcode.Encode(url, qrcode.Medium, 256)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	buf.WriteString("data:image/png;base64,")
	buf.WriteString(base64.StdEncoding.EncodeToString(png))

	return buf.String(), nil
}
