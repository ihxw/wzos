package core

/*
#define _POSIX_C_SOURCE 200809L
#include <stdlib.h>
#include <string.h>
#include <dlfcn.h>

// --- PAM types (avoid needing pam_appl.h) ---
typedef struct pam_handle pam_handle_t;

struct pam_message {
	int msg_style;
	const char *msg;
};

struct pam_response {
	char *resp;
	int resp_retcode;
};

struct pam_conv {
	int (*conv)(int, const struct pam_message **, struct pam_response **, void *);
	void *appdata_ptr;
};

#define PAM_SUCCESS       0
#define PAM_PROMPT_ECHO_OFF 1
#define PAM_PROMPT_ECHO_ON  2
#define PAM_ERROR_MSG       3
#define PAM_TEXT_INFO       4
#define PAM_SILENT          0x8000
#define PAM_AUTH_ERR        7
#define PAM_USER_UNKNOWN    18

// --- Function pointer types ---
typedef int (*pam_start_t)(const char *, const char *, const struct pam_conv *, pam_handle_t **);
typedef int (*pam_authenticate_t)(pam_handle_t *, int);
typedef int (*pam_acct_mgmt_t)(pam_handle_t *, int);
typedef int (*pam_end_t)(pam_handle_t *, int);

// --- Dynamically resolved symbols ---
static pam_start_t        dl_pam_start        = NULL;
static pam_authenticate_t dl_pam_authenticate = NULL;
static pam_acct_mgmt_t    dl_pam_acct_mgmt    = NULL;
static pam_end_t          dl_pam_end          = NULL;
static void              *pam_handle_dl       = NULL;

// --- Global password for the conversation callback ---
char *g_pam_password = NULL;

// --- PAM conversation callback ---
static int pam_conversation(int num_msg, const struct pam_message **msg,
                            struct pam_response **resp, void *appdata_ptr) {
	(void)appdata_ptr;
	if (num_msg <= 0 || msg == NULL || resp == NULL) return 1;

	struct pam_response *replies = calloc(num_msg, sizeof(struct pam_response));
	if (!replies) return 1;

	for (int i = 0; i < num_msg; i++) {
		switch (msg[i]->msg_style) {
		case PAM_PROMPT_ECHO_OFF:
			if (g_pam_password) {
				replies[i].resp = strdup(g_pam_password);
				replies[i].resp_retcode = 0;
			}
			break;
		case PAM_PROMPT_ECHO_ON:
		case PAM_ERROR_MSG:
		case PAM_TEXT_INFO:
		default:
			replies[i].resp = NULL;
			replies[i].resp_retcode = 0;
			break;
		}
	}
	*resp = replies;
	return PAM_SUCCESS;
}

// init_pam loads libpam dynamically and resolves all symbols.
// Returns 0 on success, non-zero on failure.
// On success, outputs the loaded path via loaded_path.
const char *pam_loaded_path = NULL;

static int init_pam(void) {
	if (dl_pam_start != NULL) return 0;

	const char *paths[] = {
		"libpam.so.0",
		"libpam.so",
		"/lib/x86_64-linux-gnu/libpam.so.0",
		"/usr/lib/x86_64-linux-gnu/libpam.so.0",
		"/lib/x86_64-linux-gnu/libpam.so.0.85",
		"/usr/lib/x86_64-linux-gnu/libpam.so.0.85",
		"/lib/x86_64-linux-gnu/libpam.so.0.85.1",
		"/usr/lib/x86_64-linux-gnu/libpam.so.0.85.1",
		"/lib/libpam.so.0",
		NULL
	};

	for (int i = 0; paths[i] != NULL; i++) {
		pam_handle_dl = dlopen(paths[i], RTLD_NOW);
		if (pam_handle_dl != NULL) {
			pam_loaded_path = paths[i];
			break;
		}
	}
	if (pam_handle_dl == NULL) return 1;

	dl_pam_start        = (pam_start_t)       dlsym(pam_handle_dl, "pam_start");
	dl_pam_authenticate = (pam_authenticate_t) dlsym(pam_handle_dl, "pam_authenticate");
	dl_pam_acct_mgmt    = (pam_acct_mgmt_t)    dlsym(pam_handle_dl, "pam_acct_mgmt");
	dl_pam_end          = (pam_end_t)          dlsym(pam_handle_dl, "pam_end");

	if (!dl_pam_start || !dl_pam_authenticate || !dl_pam_end) {
		dlclose(pam_handle_dl);
		pam_handle_dl = NULL;
		pam_loaded_path = NULL;
		return 1;
	}
	return 0;
}

// do_pam_auth performs the actual PAM authentication.
// Returns 0 on success, PAM error code on failure, -1 on library error.
static int do_pam_auth(const char *user, const char *password) {
	if (init_pam() != 0) return -1;

	struct pam_conv conv = { pam_conversation, NULL };
	pam_handle_t *pamh = NULL;

	int rc = dl_pam_start("login", user, &conv, &pamh);
	if (rc != PAM_SUCCESS) {
		if (pamh != NULL) dl_pam_end(pamh, rc);
		return rc;
	}

	rc = dl_pam_authenticate(pamh, PAM_SILENT);
	if (rc == PAM_SUCCESS) {
		rc = dl_pam_acct_mgmt(pamh, PAM_SILENT);
	}

	dl_pam_end(pamh, rc);
	return rc;
}
*/
import "C"

import (
	"fmt"
	"sync"
	"unsafe"
)

var pamMutex sync.Mutex

// ProbeSystemAuth checks if PAM is available without doing an actual authentication.
// Returns true if the PAM library was loaded and symbols resolved successfully.
func ProbeSystemAuth() bool {
	pamMutex.Lock()
	defer pamMutex.Unlock()

	rc := C.init_pam()
	return rc == 0
}

// SystemAuth authenticates a user against the Linux PAM system.
// Uses dlopen to load libpam at runtime — no dev headers needed.
// Returns true if the password is correct, false otherwise.
// An error is returned if the PAM mechanism is unavailable.
func SystemAuth(username, password string) (bool, error) {
	pamMutex.Lock()
	defer pamMutex.Unlock()

	cUser := C.CString(username)
	defer C.free(unsafe.Pointer(cUser))
	cPass := C.CString(password)
	defer C.free(unsafe.Pointer(cPass))

	// Set global password for the conversation callback
	C.g_pam_password = cPass
	defer func() { C.g_pam_password = nil }()

	rc := C.do_pam_auth(cUser, cPass)
	if rc == -1 {
		return false, fmt.Errorf("libpam 加载失败")
	}
	if rc == C.PAM_SUCCESS {
		if path := C.GoString(C.pam_loaded_path); path != "" {
			return true, nil
		}
		return true, nil
	}

	// Authentication failed — not an error, just wrong password
	return false, nil
}
