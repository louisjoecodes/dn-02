use wasm_bindgen::prelude::*;
use crate::{DenoiseState, FRAME_SIZE};

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub struct WasmDenoiseState {
    state: Box<DenoiseState<'static>>,
}

#[wasm_bindgen]
impl WasmDenoiseState {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            state: DenoiseState::new(),
        }
    }

    #[wasm_bindgen]
    pub fn process_frame(&mut self, input: &[f32]) -> Vec<f32> {
        if input.len() != FRAME_SIZE {
            panic!("Input frame must be exactly {} samples", FRAME_SIZE);
        }

        let mut output = vec![0.0; FRAME_SIZE];
        self.state.process_frame(&mut output, input);
        output
    }

    #[wasm_bindgen(js_name = getFrameSize)]
    pub fn get_frame_size() -> usize {
        FRAME_SIZE
    }
}

#[wasm_bindgen(start)]
pub fn main() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// Export these functions with underscores to match expected names
#[wasm_bindgen]
pub fn create_denoise_state() -> *mut WasmDenoiseState {
    Box::into_raw(Box::new(WasmDenoiseState::new()))
}

#[wasm_bindgen]
pub fn destroy_denoise_state(state: *mut WasmDenoiseState) {
    if !state.is_null() {
        unsafe { 
            let _ = Box::from_raw(state);
        }
    }
}

#[wasm_bindgen]
pub fn process_frame(state: *mut WasmDenoiseState, input: &[f32], output: &mut [f32]) -> i32 {
    if state.is_null() {
        return -1;
    }
    
    if input.len() != FRAME_SIZE || output.len() != FRAME_SIZE {
        return -2;
    }

    unsafe {
        let state = &mut *state;
        state.state.process_frame(output, input);
    }
    
    0
}

// Export a simple denoise function for easier use
#[wasm_bindgen]
pub fn denoise_audio_chunk(input: &[f32]) -> Vec<f32> {
    let mut state = WasmDenoiseState::new();
    
    // Process audio in frames
    let mut output = Vec::with_capacity(input.len());
    let mut frame_buffer = vec![0.0; FRAME_SIZE];
    
    for chunk in input.chunks(FRAME_SIZE) {
        // Pad last chunk if necessary
        frame_buffer.fill(0.0);
        frame_buffer[..chunk.len()].copy_from_slice(chunk);
        
        let processed = state.process_frame(&frame_buffer);
        output.extend_from_slice(&processed[..chunk.len()]);
    }
    
    output
}