import androidx.compose.runtime.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun App(actions: Map<String, (List<String>) -> Unit> = emptyMap()) {
    // Unsupported property tag on login for compose
    // Unsupported property attr on login for compose
    // Unsupported kind html on login for compose
    Column {
        // Unsupported property tag on email-label for compose
        // Unsupported property attr on email-label for compose
        Text("Email")
        // Unsupported property attr on email for compose
        // Unsupported property attr on email for compose
        // Unsupported property attr on email for compose
        var field0 by remember { mutableStateOf("") }
        TextField(value = field0, onValueChange = { field0 = it }, label = { Text("") })
        // Unsupported property attr on remember for compose
        // Unsupported property attr on remember for compose
        var field1 by remember { mutableStateOf(false) }
        Checkbox(checked = field1, onCheckedChange = { field1 = it })
        Button(onClick = {  }) {
            Text("Sign in")
        }
    }
}
